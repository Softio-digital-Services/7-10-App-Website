using System;
using System.IO;
using System.Windows.Forms;

namespace InventorySystem
{
    /// <summary>
    /// Centralized database and file path configuration (SQLite).
    /// User data lives under LocalAppData so installs under Program Files still work
    /// for non-admin users.
    /// </summary>
    public static class DatabaseConfig
    {
        /// <summary>SEVENTEN_DATA_DIR lets a second copy of the app run with its own data (e.g. testing cloud sync on one PC).</summary>
        private static readonly string UserDataRoot =
            Environment.GetEnvironmentVariable("SEVENTEN_DATA_DIR") is string custom && custom.Trim().Length > 0
                ? custom.Trim()
                : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SevenTenInventory");

        public static string ConnectionString
        {
            get
            {
                string dbPath = DatabasePath;
                string dir = Path.GetDirectoryName(dbPath);
                if (!Directory.Exists(dir))
                    Directory.CreateDirectory(dir);
                return $"Data Source={dbPath};";
            }
        }

        /// <summary>
        /// SQLite file: %LocalAppData%\SevenTenInventory\Data\inventory.db
        /// Migrates once from the old Program Files\...\Data\inventory.db if present.
        /// </summary>
        public static string DatabasePath
        {
            get
            {
                string dir = Path.Combine(UserDataRoot, "Data");
                if (!Directory.Exists(dir))
                    Directory.CreateDirectory(dir);

                string path = Path.Combine(dir, "inventory.db");
                TryMigrateLegacyDatabase(path);
                return path;
            }
        }

        public static string PartsImagesDirectory
        {
            get
            {
                string imagesPath = Path.Combine(UserDataRoot, "Product_Images");
                if (!Directory.Exists(imagesPath))
                    Directory.CreateDirectory(imagesPath);
                return imagesPath;
            }
        }

        /// <summary>Writable root for logs, backups, and other user files.</summary>
        public static string UserDataDirectory
        {
            get
            {
                if (!Directory.Exists(UserDataRoot))
                    Directory.CreateDirectory(UserDataRoot);
                return UserDataRoot;
            }
        }

        private static void TryMigrateLegacyDatabase(string newPath)
        {
            try
            {
                if (File.Exists(newPath)) return;

                string legacy = Path.Combine(Application.StartupPath, "Data", "inventory.db");
                if (!File.Exists(legacy)) return;

                File.Copy(legacy, newPath, overwrite: false);
                foreach (string suffix in new[] { "-wal", "-shm" })
                {
                    string side = legacy + suffix;
                    if (File.Exists(side))
                        File.Copy(side, newPath + suffix, overwrite: false);
                }
            }
            catch
            {
                // First-run create is fine if copy fails
            }
        }
    }
}
