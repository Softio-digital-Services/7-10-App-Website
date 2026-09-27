import { MessageActions } from "@/components/admin/message-actions";
import { prisma } from "@/lib/prisma";

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default async function AdminMessagesPage() {
  const messages = await prisma.contactMessage.findMany({ orderBy: [{ read: "asc" }, { createdAt: "desc" }], take: 200 });

  if (messages.length === 0) {
    return <p className="border border-dashed border-charcoal/25 px-6 py-16 text-center text-charcoal/55">No messages yet. Anything sent from the Contact page shows up here.</p>;
  }

  return (
    <ul className="space-y-3">
      {messages.map((m) => (
        <li key={m.id} className={`border p-5 md:p-6 ${m.read ? "border-charcoal/10" : "border-charcoal bg-cream-2/50"}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2.5 font-medium">
                {!m.read && <span className="dot-signal" />}
                {m.name}
                <span className="font-normal text-charcoal/55">· {m.email}</span>
              </p>
              <p className="mt-1 text-[12.5px] text-charcoal/50">
                {m.subject && <span className="me-2 bg-charcoal px-2 py-0.5 text-cream">{m.subject}</span>}
                {dateFmt.format(m.createdAt)}
              </p>
            </div>
            <MessageActions id={m.id} read={m.read} email={m.email} subject={m.subject} />
          </div>
          <p className="mt-4 whitespace-pre-line text-[14.5px] leading-relaxed text-charcoal/80">{m.message}</p>
        </li>
      ))}
    </ul>
  );
}
