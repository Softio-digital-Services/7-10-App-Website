type BracketsProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
  inset?: string;
};

/**
 * The viewfinder corners from the old 7.10 look. The trail style uses rounded panels
 * instead, so this renders nothing; callers can stay as they are.
 */
export function Brackets(props: BracketsProps) {
  void props;
  return null;
}
