type SectionLabelProps = {
  index?: string;
  children: React.ReactNode;
  className?: string;
  tone?: "dark" | "light";
};

export function SectionLabel({ index, children, className = "", tone = "dark" }: SectionLabelProps) {
  const muted = tone === "light" ? "text-cream/70" : "text-charcoal/60";
  const line = tone === "light" ? "bg-cream/40" : "bg-charcoal/30";
  return (
    <p className={`eyebrow flex items-center gap-3 ${muted} ${className}`}>
      {index && (
        <span className="font-display keep-tracking tracking-[0.2em]" dir="ltr">
          [{index}]
        </span>
      )}
      <span className={`h-px w-8 ${line}`} aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
