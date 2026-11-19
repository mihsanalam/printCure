export function BrandMark({ size = 40 }) {
  return (
    <svg
      className="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label="PrintCure"
    >
      <rect x="1" y="1" width="46" height="46" rx="14" fill="#2f5fe0" />
      <path
        d="M14 9h13l7 7v17a5 5 0 0 1-5 5H14a5 5 0 0 1-5-5V14a5 5 0 0 1 5-5z"
        fill="#f7f9fd"
      />
      <path d="M27 9l7 7h-7z" fill="#cbd5e8" />
      <path
        d="M24 34.5c-1.1-.9-5.6-4.1-5.6-7.4a3.5 3.5 0 0 1 5.6-2.8 3.5 3.5 0 0 1 5.6 2.8c0 3.3-4.5 6.5-5.6 7.4z"
        fill="#2f5fe0"
      />
      <circle cx="11" cy="12" r="1.6" fill="#afc5ff" />
      <circle cx="37" cy="37" r="2" fill="#afc5ff" />
    </svg>
  );
}

export default function BrandLogo({ size = 40, showWordmark = true }) {
  return (
    <div className="brand">
      <BrandMark size={size} />
      {showWordmark && (
        <span className="brand-name">
          Print<span className="brand-name-accent">Cure</span>
        </span>
      )}
    </div>
  );
}
