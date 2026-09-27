type LogoMarkProps = {
  className?: string;
  tone?: "silver" | "cream" | "charcoal" | "current";
  title?: string;
};

const tones = {
  silver: "#C7C6C0",
  cream: "#F1EEE4",
  charcoal: "#1D1D16",
  current: "currentColor",
};

export function LogoMark({ className, tone = "current", title = "7.10" }: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 463 366"
      className={className}
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <polygon points="0,0 92,0 219,217 180,284" fill={tones[tone]} />
      <polygon points="118,0 463,0 231,366 194,304 322,77 162,77" fill={tones[tone]} />
      <polygon points="174,97 290,97 232,195" fill="#F51E0F" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`font-display font-semibold uppercase keep-tracking tracking-[0.3em] ${className ?? ""}`} dir="ltr">
      7.10
    </span>
  );
}
