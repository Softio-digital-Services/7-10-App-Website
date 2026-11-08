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

type LogoProps = {
  variant?: "horizontal" | "stacked" | "mark";
  /** "auto" swaps to the on-dark artwork in dark mode; "on-dark" is for olive grounds. */
  tone?: "auto" | "on-dark";
  className?: string;
};

/** The 7.10 logo kit in /public/brand/logo, following the design system's logo rules. */
export function Logo({ variant = "horizontal", tone = "auto", className = "" }: LogoProps) {
  const base = `/brand/logo/710-${variant}`;
  if (tone === "on-dark") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`${base}-on-dark.svg`} alt="7.10" className={className} />;
  }
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${base}.svg`} alt="7.10" className={className} data-logo-light="" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${base}-on-dark.svg`} alt="7.10" className={className} data-logo-dark="" />
    </>
  );
}
