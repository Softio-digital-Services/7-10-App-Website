type SectionLabelProps = {
  index?: string;
  children: React.ReactNode;
  className?: string;
  tone?: "dark" | "light";
};

/** Small spaced caps above a heading, e.g. "01 · THE DIFFERENCE". Numbered labels are red on light sections. */
export function SectionLabel({ index, children, className = "", tone = "dark" }: SectionLabelProps) {
  const color = tone === "light" ? "text-cream/70" : index ? "text-signal" : "text-charcoal/70";
  return (
    <p className={`eyebrow flex items-center gap-2 text-[10.5px] ${color} ${className}`}>
      {index && (
        <>
          <span dir="ltr">{index}</span>
          <span aria-hidden="true">·</span>
        </>
      )}
      <span>{children}</span>
    </p>
  );
}
