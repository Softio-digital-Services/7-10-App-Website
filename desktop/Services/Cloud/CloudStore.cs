using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using Microsoft.Data.Sqlite;

namespace InventorySystem.Services.Cloud
{
    /// <summary>
    /// Local bookkeeping for cloud sync, kept in the shop database itself so it is always consistent with the data:
    /// an outbox filled by triggers, the local-id ↔ hub-id map, changes waiting for a missing parent, and the pull cursor.
    /// </summary>
    internal static class CloudStore
    {
        public const string WebLinksTable = "web_order_links";
        private const string TriggerPrefix = "_sync_t_";
        private const string Guard = "(SELECT applying FROM _sync_state WHERE id = 1) = 0";

        private static readonly object ColumnLock = new();
        private static readonly Dictionary<string, List<string>> ColumnCache = new(StringComparer.OrdinalIgnoreCase);

        public static SqliteConnection Open()
        {
            var conn = new SqliteConnection(DatabaseConfig.ConnectionString);
            conn.Open();
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "PRAGMA busy_timeout = 15000;";
                cmd.ExecuteNonQuery();
            }
            return conn;
        }

        // ---------- SQL helpers (positional @p0, @p1, …) ----------

        public static SqliteCommand Command(SqliteConnection conn, SqliteTransaction tx, string sql, params object[] args)
        {
            var cmd = conn.CreateCommand();
            cmd.Transaction = tx;
            cmd.CommandText = sql;
            for (int i = 0; i < args.Length; i++)
                cmd.Parameters.AddWithValue("@p" + i, args[i] ?? DBNull.Value);
            return cmd;
        }

        public static int Exec(SqliteConnection conn, SqliteTransaction tx, string sql, params object[] args)
        {
            using var cmd = Command(conn, tx, sql, args);
            return cmd.ExecuteNonQuery();
        }

        public static object Scalar(SqliteConnection conn, SqliteTransaction tx, string sql, params object[] args)
        {
            using var cmd = Command(conn, tx, sql, args);
            object v = cmd.ExecuteScalar();
            return v == DBNull.Value ? null : v;
        }

        public static long Long(SqliteConnection conn, SqliteTransaction tx, string sql, params object[] args)
        {
            object v = Scalar(conn, tx, sql, args);
            return v == null ? 0 : Convert.ToInt64(v);
        }

        public static string Quote(string identifier) => "\"" + identifier.Replace("\"", "\"\"") + "\"";

        // ---------- schema ----------

        public static void EnsureTables(SqliteConnection conn, SqliteTransaction tx)
        {
            string[] statements =
            {
                "CREATE TABLE IF NOT EXISTS _sync_state (id INTEGER PRIMARY KEY CHECK (id = 1), applying INTEGER NOT NULL DEFAULT 0)",
                "INSERT OR IGNORE INTO _sync_state (id, applying) VALUES (1, 0)",
                "CREATE TABLE IF NOT EXISTS _sync_outbox (seq INTEGER PRIMARY KEY AUTOINCREMENT, tbl TEXT NOT NULL, lid INTEGER NOT NULL, op TEXT NOT NULL, col TEXT, delta REAL)",
                "CREATE TABLE IF NOT EXISTS _sync_map (tbl TEXT NOT NULL, gid TEXT NOT NULL, lid INTEGER NOT NULL, PRIMARY KEY (tbl, gid))",
                "CREATE INDEX IF NOT EXISTS _sync_map_lid ON _sync_map (tbl, lid)",
                "CREATE TABLE IF NOT EXISTS _sync_pending (id INTEGER PRIMARY KEY AUTOINCREMENT, seq INTEGER NOT NULL, tbl TEXT NOT NULL, gid TEXT NOT NULL, op TEXT NOT NULL, data TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, reason TEXT)",
                "CREATE TABLE IF NOT EXISTS _sync_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT)",
                "CREATE TABLE IF NOT EXISTS _sync_uploads (path TEXT PRIMARY KEY NOT NULL, size INTEGER NOT NULL, mtime INTEGER NOT NULL, name TEXT NOT NULL)",
                "CREATE TABLE IF NOT EXISTS _sync_web (order_number TEXT PRIMARY KEY NOT NULL, order_lid INTEGER, ack_sent INTEGER NOT NULL DEFAULT 0, error TEXT, last_try INTEGER, pushed_status TEXT, pushed_paid INTEGER)",
                "CREATE TABLE IF NOT EXISTS _sync_log (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL DEFAULT (datetime('now','localtime')), message TEXT NOT NULL)",
                $"CREATE TABLE IF NOT EXISTS {WebLinksTable} (id INTEGER PRIMARY KEY AUTOINCREMENT, order_number TEXT NOT NULL UNIQUE, order_id INTEGER, created_at TEXT DEFAULT (datetime('now','localtime')))",
            };
            foreach (string sql in statements) Exec(conn, tx, sql);
        }

        public static bool HasSyncTables(SqliteConnection conn) =>
            Long(conn, null, "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = '_sync_state'") > 0;

        public static void ResetColumnCache()
        {
            lock (ColumnLock) ColumnCache.Clear();
        }

        public static List<string> Columns(SqliteConnection conn, SqliteTransaction tx, string table)
        {
            lock (ColumnLock)
            {
                if (ColumnCache.TryGetValue(table, out var cached)) return cached;
            }
            var cols = new List<string>();
            using (var cmd = Command(conn, tx, $"PRAGMA table_info({Quote(table)})"))
            using (var r = cmd.ExecuteReader())
                while (r.Read()) cols.Add(r.GetString(1));
            lock (ColumnLock) ColumnCache[table] = cols;
            return cols;
        }

        public static bool TableExists(SqliteConnection conn, SqliteTransaction tx, string table) => Columns(conn, tx, table).Count > 0;

        /// <summary>Column sets of the table's UNIQUE constraints (excluding the primary key).</summary>
        public static List<string[]> UniqueKeys(SqliteConnection conn, SqliteTransaction tx, string table)
        {
            var names = new List<string>();
            using (var cmd = Command(conn, tx, $"PRAGMA index_list({Quote(table)})"))
            using (var r = cmd.ExecuteReader())
            {
                while (r.Read())
                {
                    bool unique = Convert.ToInt32(r["unique"]) == 1;
                    string origin = r["origin"]?.ToString() ?? "";
                    bool partial = Convert.ToInt32(r["partial"]) == 1;
                    if (unique && !partial && origin != "pk") names.Add(r["name"].ToString());
                }
            }
            var keys = new List<string[]>();
            foreach (string index in names)
            {
                var cols = new List<string>();
                using var cmd = Command(conn, tx, $"PRAGMA index_info({Quote(index)})");
                using var r = cmd.ExecuteReader();
                while (r.Read()) if (!r.IsDBNull(2)) cols.Add(r.GetString(2));
                if (cols.Count > 0) keys.Add(cols.ToArray());
            }
            return keys;
        }

        // ---------- change capture ----------

        public static void RemoveTriggers(SqliteConnection conn, SqliteTransaction tx)
        {
            var names = new List<string>();
            using (var cmd = Command(conn, tx, "SELECT name FROM sqlite_master WHERE type = 'trigger' AND substr(name, 1, @p0) = @p1",
                       TriggerPrefix.Length, TriggerPrefix))
            using (var r = cmd.ExecuteReader())
                while (r.Read()) names.Add(r.GetString(0));
            foreach (string name in names) Exec(conn, tx, "DROP TRIGGER IF EXISTS " + Quote(name));
        }

        /// <summary>
        /// (Re)creates the triggers that record every insert, edit, delete and stock/balance movement into the outbox.
        /// Rebuilt at every start so columns added by app updates are watched too.
        /// </summary>
        public static void InstallTriggers(SqliteConnection conn, SqliteTransaction tx)
        {
            RemoveTriggers(conn, tx);
            ResetColumnCache();
            foreach (var table in SyncTables.All)
            {
                var cols = Columns(conn, tx, table.Name);
                if (cols.Count == 0 || !cols.Contains(table.Pk, StringComparer.OrdinalIgnoreCase)) continue;

                string t = table.Name;
                string qt = Quote(t);
                string pk = Quote(table.Pk);
                string lit = "'" + t + "'";
                var counters = cols.Where(c => table.Counters.Contains(c)).ToList();
                var plain = cols.Where(c => !c.Equals(table.Pk, StringComparison.OrdinalIgnoreCase) && !table.Counters.Contains(c)).ToList();

                var insert = new StringBuilder();
                insert.Append($"CREATE TRIGGER {Quote(TriggerPrefix + t + "_i")} AFTER INSERT ON {qt} WHEN {Guard} BEGIN ");
                insert.Append($"INSERT INTO _sync_outbox (tbl, lid, op) VALUES ({lit}, NEW.{pk}, 'U'); ");
                foreach (string c in counters)
                {
                    string qc = Quote(c);
                    insert.Append($"INSERT INTO _sync_outbox (tbl, lid, op, col, delta) SELECT {lit}, NEW.{pk}, 'C', '{c}', NEW.{qc} WHERE COALESCE(NEW.{qc}, 0) <> 0; ");
                }
                insert.Append("END");
                Exec(conn, tx, insert.ToString());

                if (plain.Count > 0)
                {
                    string changed = string.Join(" OR ", plain.Select(c => $"NEW.{Quote(c)} IS NOT OLD.{Quote(c)}"));
                    Exec(conn, tx,
                        $"CREATE TRIGGER {Quote(TriggerPrefix + t + "_u")} AFTER UPDATE ON {qt} WHEN {Guard} AND ({changed}) BEGIN " +
                        $"INSERT INTO _sync_outbox (tbl, lid, op) VALUES ({lit}, NEW.{pk}, 'U'); END");
                }

                foreach (string c in counters)
                {
                    string qc = Quote(c);
                    Exec(conn, tx,
                        $"CREATE TRIGGER {Quote(TriggerPrefix + t + "_c_" + c)} AFTER UPDATE OF {qc} ON {qt} " +
                        $"WHEN {Guard} AND COALESCE(NEW.{qc}, 0) <> COALESCE(OLD.{qc}, 0) BEGIN " +
                        $"INSERT INTO _sync_outbox (tbl, lid, op, col, delta) VALUES ({lit}, NEW.{pk}, 'C', '{c}', COALESCE(NEW.{qc}, 0) - COALESCE(OLD.{qc}, 0)); END");
                }

                Exec(conn, tx,
                    $"CREATE TRIGGER {Quote(TriggerPrefix + t + "_d")} AFTER DELETE ON {qt} WHEN {Guard} BEGIN " +
                    $"INSERT INTO _sync_outbox (tbl, lid, op) VALUES ({lit}, OLD.{pk}, 'D'); END");
            }
        }

        /// <summary>While set, the triggers stay quiet: rows written by the sync itself must not echo back to the hub.</summary>
        public static void SetApplying(SqliteConnection conn, SqliteTransaction tx, bool on) =>
            Exec(conn, tx, "UPDATE _sync_state SET applying = @p0 WHERE id = 1", on ? 1 : 0);

        // ---------- meta ----------

        public static string GetMeta(SqliteConnection conn, SqliteTransaction tx, string key) =>
            Scalar(conn, tx, "SELECT value FROM _sync_meta WHERE key = @p0", key)?.ToString();

        public static void SetMeta(SqliteConnection conn, SqliteTransaction tx, string key, string value) =>
            Exec(conn, tx, "INSERT INTO _sync_meta (key, value) VALUES (@p0, @p1) ON CONFLICT(key) DO UPDATE SET value = excluded.value", key, value);

        public static long GetMetaLong(SqliteConnection conn, SqliteTransaction tx, string key) =>
            long.TryParse(GetMeta(conn, tx, key), out long v) ? v : 0;

        public static void Log(SqliteConnection conn, SqliteTransaction tx, string message)
        {
            Exec(conn, tx, "INSERT INTO _sync_log (message) VALUES (@p0)", message.Length > 500 ? message.Substring(0, 500) : message);
            Exec(conn, tx, "DELETE FROM _sync_log WHERE id <= (SELECT MAX(id) FROM _sync_log) - 200");
        }

        // ---------- id map ----------

        public static string GidFor(SqliteConnection conn, SqliteTransaction tx, string table, long lid, string deviceId, bool create)
        {
            var gid = Scalar(conn, tx, "SELECT gid FROM _sync_map WHERE tbl = @p0 AND lid = @p1 ORDER BY rowid LIMIT 1", table, lid)?.ToString();
            if (gid != null || !create) return gid;
            gid = deviceId + "-" + lid;
            Exec(conn, tx, "INSERT OR REPLACE INTO _sync_map (tbl, gid, lid) VALUES (@p0, @p1, @p2)", table, gid, lid);
            return gid;
        }

        public static long? LidFor(SqliteConnection conn, SqliteTransaction tx, string table, string gid)
        {
            object v = Scalar(conn, tx, "SELECT lid FROM _sync_map WHERE tbl = @p0 AND gid = @p1", table, gid);
            return v == null ? null : Convert.ToInt64(v);
        }

        public static void MapSet(SqliteConnection conn, SqliteTransaction tx, string table, string gid, long lid) =>
            Exec(conn, tx, "INSERT OR REPLACE INTO _sync_map (tbl, gid, lid) VALUES (@p0, @p1, @p2)", table, gid, lid);

        public static void MapDropLid(SqliteConnection conn, SqliteTransaction tx, string table, long lid) =>
            Exec(conn, tx, "DELETE FROM _sync_map WHERE tbl = @p0 AND lid = @p1", table, lid);

        public static bool RowExists(SqliteConnection conn, SqliteTransaction tx, SyncTable table, long lid) =>
            Long(conn, tx, $"SELECT COUNT(*) FROM {Quote(table.Name)} WHERE {Quote(table.Pk)} = @p0", lid) > 0;
    }
}
