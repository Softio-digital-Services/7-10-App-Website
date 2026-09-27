export const orderStatuses = ["PENDING", "CONFIRMED", "PACKED", "SHIPPED", "DELIVERED", "CANCELLED"] as const;

export function statusLabel(status: string) {
  return status === "SHIPPED" ? "Out for delivery" : status.charAt(0) + status.slice(1).toLowerCase();
}

export function StatusPill({ status }: { status: string }) {
  const tone =
    status === "CANCELLED"
      ? "bg-signal/10 text-signal"
      : status === "DELIVERED"
        ? "bg-olive text-cream"
        : status === "PENDING"
          ? "bg-charcoal text-cream"
          : "bg-cream-2";
  return <span className={`inline-block whitespace-nowrap px-2.5 py-1 text-[12px] ${tone}`}>{statusLabel(status)}</span>;
}
