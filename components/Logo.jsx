// Custom MotoDNA logo - hexagonal chip frame with DNA helix forming an M
export default function Logo({ size = 40, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="mdnaGrad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#F97316" />
          <stop offset="1" stopColor="#DC2626" />
        </linearGradient>
        <linearGradient id="mdnaGrad2" x1="0" y1="64" x2="64" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FCD34D" />
          <stop offset="1" stopColor="#F97316" />
        </linearGradient>
      </defs>
      {/* hex chip frame */}
      <path d="M32 3 L56 17 L56 47 L32 61 L8 47 L8 17 Z" fill="#0a0a0a" stroke="url(#mdnaGrad)" strokeWidth="2" />
      {/* chip pins */}
      <rect x="2" y="22" width="4" height="3" fill="url(#mdnaGrad)" />
      <rect x="2" y="31" width="4" height="3" fill="url(#mdnaGrad)" />
      <rect x="2" y="40" width="4" height="3" fill="url(#mdnaGrad)" />
      <rect x="58" y="22" width="4" height="3" fill="url(#mdnaGrad)" />
      <rect x="58" y="31" width="4" height="3" fill="url(#mdnaGrad)" />
      <rect x="58" y="40" width="4" height="3" fill="url(#mdnaGrad)" />
      {/* DNA helix forming M */}
      <path d="M18 44 C 18 30, 24 24, 32 32 C 40 40, 46 34, 46 20" stroke="url(#mdnaGrad2)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M18 20 C 18 34, 24 40, 32 32 C 40 24, 46 30, 46 44" stroke="url(#mdnaGrad)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* rungs */}
      <line x1="22" y1="26" x2="22" y2="38" stroke="#F97316" strokeWidth="1.2" opacity="0.7" />
      <line x1="32" y1="28" x2="32" y2="36" stroke="#FCD34D" strokeWidth="1.2" opacity="0.9" />
      <line x1="42" y1="26" x2="42" y2="38" stroke="#F97316" strokeWidth="1.2" opacity="0.7" />
      {/* central pulse dot */}
      <circle cx="32" cy="32" r="2" fill="#FCD34D">
        <animate attributeName="opacity" values="1;0.3;1" dur="1.6s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}
