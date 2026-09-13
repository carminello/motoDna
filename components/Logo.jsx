// MotoDNA logo - Café Racer style emblem
// Vintage racing badge with a stripped-down café racer silhouette
export default function Logo({ size = 40, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="mdnaOrange" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#F97316" />
          <stop offset="1" stopColor="#DC2626" />
        </linearGradient>
      </defs>

      {/* Vintage tank badge - rounded shield */}
      <path
        d="M32 2 C 46 2, 60 8, 60 22 L 60 42 C 60 56, 46 62, 32 62 C 18 62, 4 56, 4 42 L 4 22 C 4 8, 18 2, 32 2 Z"
        fill="#0a0a0a"
        stroke="url(#mdnaOrange)"
        strokeWidth="2"
      />

      {/* Inner double stroke - racing badge feel */}
      <path
        d="M32 6 C 44 6, 56 11, 56 22 L 56 42 C 56 53, 44 58, 32 58 C 20 58, 8 53, 8 42 L 8 22 C 8 11, 20 6, 32 6 Z"
        fill="none"
        stroke="rgba(249,115,22,0.25)"
        strokeWidth="0.8"
      />

      {/* Racing stripe diagonal */}
      <path d="M4 26 L 60 26 L 60 30 L 4 30 Z" fill="url(#mdnaOrange)" opacity="0.15" />

      {/* Café racer silhouette - side view */}
      <g stroke="#fafafa" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* rear wheel */}
        <circle cx="46" cy="40" r="6" strokeWidth="1.6" />
        <circle cx="46" cy="40" r="1.5" fill="#fafafa" stroke="none" />
        {/* front wheel */}
        <circle cx="18" cy="40" r="6" strokeWidth="1.6" />
        <circle cx="18" cy="40" r="1.5" fill="#fafafa" stroke="none" />
        {/* fuel tank - teardrop shape */}
        <path d="M22 32 C 22 28, 26 26, 32 26 C 36 26, 39 27, 40 30 L 40 32 Z" fill="#fafafa" stroke="#fafafa" strokeWidth="0.8" />
        {/* seat hump (café racer signature) */}
        <path d="M40 32 C 44 32, 47 30, 48 28 C 49 27, 50 27, 50 28 L 50 32 Z" fill="url(#mdnaOrange)" stroke="url(#mdnaOrange)" strokeWidth="0.8" />
        {/* frame */}
        <path d="M22 32 L 30 38 L 40 38 L 40 32" />
        <path d="M46 40 L 42 34" />
        <path d="M22 32 L 18 40" />
        {/* clip-on handlebars - low bars */}
        <path d="M18 34 L 15 30" strokeWidth="1.4" />
        {/* front headlight - round */}
        <circle cx="14" cy="30" r="2" fill="#fafafa" stroke="none" />
        {/* exhaust pipe */}
        <path d="M30 40 L 44 42" strokeWidth="1.4" />
      </g>

      {/* Bottom motorsport dots */}
      <circle cx="26" cy="54" r="0.8" fill="url(#mdnaOrange)" />
      <circle cx="32" cy="54" r="0.8" fill="url(#mdnaOrange)" />
      <circle cx="38" cy="54" r="0.8" fill="url(#mdnaOrange)" />
    </svg>
  );
}
