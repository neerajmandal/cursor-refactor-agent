export function CuralLogo({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M14.2 4.75a6.4 6.4 0 1 0 0 10.5"
        stroke="currentColor"
        strokeWidth="2.35"
        strokeLinecap="round"
      />
      <circle cx="15.55" cy="10" r="2.2" fill="#7c3aed" />
    </svg>
  );
}
