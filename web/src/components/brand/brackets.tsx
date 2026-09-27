type BracketsProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
  inset?: string;
};

const sizes = {
  sm: "h-3 w-3",
  md: "h-5 w-5 md:h-7 md:w-7",
  lg: "h-7 w-7 md:h-10 md:w-10",
};

/** Viewfinder corners from the 7.10 brand site. */
export function Brackets({ className = "", size = "md", inset = "-0.75rem" }: BracketsProps) {
  const s = sizes[size];
  const style = { "--b": inset } as React.CSSProperties;
  return (
    <span aria-hidden="true" className={`pointer-events-none absolute inset-0 ${className}`} style={style}>
      <span className={`absolute ${s} border-t border-s border-current`} style={{ top: "var(--b)", insetInlineStart: "var(--b)" }} />
      <span className={`absolute ${s} border-t border-e border-current`} style={{ top: "var(--b)", insetInlineEnd: "var(--b)" }} />
      <span className={`absolute ${s} border-b border-s border-current`} style={{ bottom: "var(--b)", insetInlineStart: "var(--b)" }} />
      <span className={`absolute ${s} border-b border-e border-current`} style={{ bottom: "var(--b)", insetInlineEnd: "var(--b)" }} />
    </span>
  );
}
