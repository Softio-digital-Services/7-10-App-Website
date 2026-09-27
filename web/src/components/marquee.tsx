type MarqueeProps = {
  items: string[];
  className?: string;
  itemClassName?: string;
  duration?: number;
  separator?: React.ReactNode;
};

export function Marquee({ items, className = "", itemClassName = "", duration = 38, separator }: MarqueeProps) {
  const sep = separator ?? <span className="tri-signal mx-6 md:mx-10" aria-hidden="true" />;
  const row = (hidden: boolean) => (
    <div className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {Array.from({ length: 3 }).flatMap((_, round) =>
        items.map((item, i) => (
          <span key={`${round}-${i}`} className="flex items-center">
            <span className={itemClassName}>{item}</span>
            {sep}
          </span>
        )),
      )}
    </div>
  );

  return (
    <div className={`marquee overflow-hidden ${className}`}>
      <div className="marquee-track" style={{ "--marquee-duration": `${duration}s` } as React.CSSProperties}>
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
