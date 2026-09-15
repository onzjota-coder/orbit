function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="5.5" stroke="currentColor" strokeWidth="1.5" />
      <ellipse
        cx="12"
        cy="12"
        rx="10.5"
        ry="3.4"
        stroke="currentColor"
        strokeWidth="1.2"
        transform="rotate(-16 12 12)"
      />
    </svg>
  );
}

export default Logo;
