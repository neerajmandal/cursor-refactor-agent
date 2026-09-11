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
        d="M10 1.5L17.5 5.5V14.5L10 18.5L2.5 14.5V5.5L10 1.5Z"
        fill="#1a1a1a"
      />
      <path
        d="M10 1.5L17.5 5.5L10 9.5L2.5 5.5L10 1.5Z"
        fill="#3f3f46"
      />
      <path
        d="M10 9.5V18.5L17.5 14.5V5.5L10 9.5Z"
        fill="#27272a"
      />
      <path
        d="M10 9.5V18.5L2.5 14.5V5.5L10 9.5Z"
        fill="#52525b"
      />
    </svg>
  );
}
