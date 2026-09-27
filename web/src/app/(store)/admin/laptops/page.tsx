import { MonitorSmartphone } from "lucide-react";
import { DeviceActions } from "@/components/admin/device-actions";
import { prisma } from "@/lib/prisma";
import { currentHead, hubState } from "@/lib/hub/store";

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

const STATE_TEXT = {
  empty: "No laptop has created the shop yet. Open the desktop app → Settings → Cloud sync and connect the main laptop first.",
  founding: "The first laptop is uploading the shop's data. Other laptops can join as soon as it finishes.",
  ready: "Every linked laptop shares the same products, stock, customers and orders, and website orders flow into the desktop Orders board.",
} as const;

function ago(date: Date | null, now: number) {
  if (!date) return "never";
  const mins = Math.round((now - date.getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} days ago`;
}

function loadTime() {
  return Date.now();
}

export default async function AdminLaptopsPage() {
  const [state, head, devices] = await Promise.all([
    hubState(),
    currentHead(),
    prisma.syncDevice.findMany({ orderBy: [{ revokedAt: "asc" }, { lastSeenAt: "desc" }] }),
  ]);
  const now = loadTime();

  return (
    <div className="space-y-6">
      <p className="flex items-start gap-3 bg-olive/10 p-4 text-[14px] text-charcoal/80">
        <MonitorSmartphone className="mt-0.5 h-5 w-5 shrink-0 text-olive" strokeWidth={1.5} />
        <span>{STATE_TEXT[state]}</span>
      </p>

      {devices.length === 0 ? (
        <p className="border border-dashed border-charcoal/25 px-6 py-16 text-center text-charcoal/55">No laptops linked yet.</p>
      ) : (
        <ul className="space-y-3">
          {devices.map((d) => {
            const online = !d.revokedAt && d.lastSeenAt && now - d.lastSeenAt.getTime() < 5 * 60_000;
            const behind = Math.max(0, head - d.cursor);
            return (
              <li key={d.id} className={`border p-5 md:p-6 ${d.revokedAt ? "border-charcoal/10 opacity-60" : "border-charcoal/15"}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2.5 font-medium">
                      <span className={`inline-block h-2 w-2 rounded-full ${online ? "bg-olive" : "bg-charcoal/25"}`} aria-hidden />
                      {d.name}
                      <span className="font-normal text-charcoal/45" dir="ltr">
                        #{d.id}
                      </span>
                    </p>
                    <p className="mt-1 text-[13px] text-charcoal/55">
                      {d.revokedAt
                        ? `Revoked ${dateFmt.format(d.revokedAt)}`
                        : `Last sync ${ago(d.lastSeenAt, now)}${behind > 0 && !online ? ` · ${behind} changes waiting` : ""}`}
                      {d.appVersion ? ` · app ${d.appVersion}` : ""} · linked {dateFmt.format(d.createdAt)}
                    </p>
                  </div>
                  {!d.revokedAt && <DeviceActions id={d.id} name={d.name} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
