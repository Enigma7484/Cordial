export default function BrandMark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const classes = {
    sm: "h-9 w-9",
    md: "h-12 w-12",
    lg: "h-16 w-16",
  };

  return (
    <span className={`${classes[size]} brand-mark`} aria-hidden="true">
      <svg viewBox="0 0 64 64" role="img">
        <rect x="6" y="6" width="52" height="52" rx="14" />
        <path d="M43 22a16 16 0 1 0 0 20" />
        <path d="M32 32h14" />
        <circle cx="44" cy="22" r="3" />
        <circle cx="46" cy="32" r="3" />
        <circle cx="44" cy="42" r="3" />
      </svg>
    </span>
  );
}
