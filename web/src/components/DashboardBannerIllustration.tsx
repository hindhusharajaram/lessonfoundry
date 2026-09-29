import React from 'react';

interface IllustrationProps {
  className?: string;
}

export const DashboardBannerIllustration: React.FC<IllustrationProps> = ({
  className = 'w-full h-auto',
}) => {
  return (
    <svg
      viewBox="0 0 340 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Evidence-locked curriculum banner illustration"
    >
      {/* Soft base shadow */}
      <ellipse cx="170" cy="165" rx="140" ry="8" fill="#0B1437" fillOpacity="0.25" />

      {/* --- POTTED PLANT ON FAR RIGHT --- */}
      <path
        d="M275 125 L268 160 Q268 163 280 163 L298 163 Q310 163 310 160 L303 125 Z"
        fill="#0F172A"
      />
      <path
        d="M288 125 Q295 85 325 80 Q310 110 288 125 Z"
        fill="#FFFFFF"
        stroke="#0F172A"
        strokeWidth="2"
      />
      <path
        d="M284 125 Q270 70 308 55 Q295 95 284 125 Z"
        fill="#FFFFFF"
        stroke="#0F172A"
        strokeWidth="2"
      />

      {/* --- EVIDENCE PACK DOCUMENT (CENTER) --- */}
      {/* Document Shadow */}
      <rect x="145" y="45" width="105" height="115" rx="10" fill="#0B1437" fillOpacity="0.2" />
      {/* Document Sheet */}
      <rect
        x="140"
        y="40"
        width="105"
        height="115"
        rx="10"
        fill="#FFFFFF"
        stroke="#0F172A"
        strokeWidth="2.2"
      />
      {/* Header bar */}
      <rect x="152" y="52" width="48" height="7" rx="3" fill="#0F172A" />
      <rect x="206" y="53" width="26" height="5" rx="2.5" fill="#CBD5E1" />

      {/* Item 1 with Check */}
      <circle cx="156" cy="74" r="4.5" fill="#0F172A" />
      <path d="M154 74 L155.5 75.5 L158.5 72.5" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="166" y1="72" x2="230" y2="72" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" />
      <line x1="166" y1="78" x2="215" y2="78" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round" />

      {/* Quote Evidence Box */}
      <rect x="151" y="90" width="82" height="26" rx="5" fill="#F8FAFC" stroke="#0F172A" strokeWidth="1.2" strokeDasharray="3 2" />
      <line x1="158" y1="98" x2="225" y2="98" stroke="#64748B" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="158" y1="106" x2="212" y2="106" stroke="#64748B" strokeWidth="1.8" strokeLinecap="round" />

      {/* Item 2 */}
      <circle cx="156" cy="130" r="4.5" fill="#0F172A" />
      <path d="M154 130 L155.5 131.5 L158.5 128.5" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="166" y1="130" x2="228" y2="130" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" />

      {/* Magnifying Glass Verifier Lens */}
      <g transform="translate(108, 80)">
        <circle cx="28" cy="28" r="22" fill="#0B1437" fillOpacity="0.15" />
        <circle cx="26" cy="26" r="22" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2.4" />
        <circle cx="26" cy="26" r="17" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1" strokeDasharray="2 2" />
        {/* Verification Check inside lens */}
        <path d="M19 26 L24 31 L34 20" stroke="#0F172A" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        {/* Handle */}
        <path d="M42 42 L54 54" stroke="#0F172A" strokeWidth="4.5" strokeLinecap="round" />
      </g>

      {/* --- TEACHER / SCHOLAR FIGURE (LEFT) --- */}
      {/* Back leg */}
      <path d="M82 110 L78 155" stroke="#0F172A" strokeWidth="2" />
      <path d="M89 110 L87 155" stroke="#0F172A" strokeWidth="2" />
      <path d="M74 155 L90 155 L92 162 L70 162 Z" fill="#0F172A" />

      {/* Front leg */}
      <path d="M93 110 L99 157" stroke="#0F172A" strokeWidth="2" />
      <path d="M101 110 L107 157" stroke="#0F172A" strokeWidth="2" />
      <path d="M96 157 L112 157 L116 164 L92 164 Z" fill="#0F172A" />

      {/* Torso / Blazer */}
      <path
        d="M78 52 L104 48 L110 110 L75 110 Z"
        fill="#FFFFFF"
        stroke="#0F172A"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path d="M86 51 L91 80 L99 49" stroke="#0F172A" strokeWidth="1.5" />

      {/* Arm pointing towards document */}
      <path d="M102 58 Q120 68 135 60" stroke="#0F172A" strokeWidth="2.2" strokeLinecap="round" fill="none" />

      {/* Left arm holding curriculum notes */}
      <path d="M80 58 L68 85 L84 92" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" fill="none" />
      <rect x="62" y="80" width="18" height="24" rx="3" transform="rotate(-15 62 80)" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.6" />

      {/* Head & Neck */}
      <rect x="88" y="40" width="6" height="9" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.5" />
      <ellipse cx="91" cy="30" rx="10" ry="11" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2" />
      {/* Black hair */}
      <path d="M82 30 C80 18 90 14 99 18 C102 21 103 27 101 32 C98 24 93 21 85 27 Z" fill="#0F172A" />
      <circle cx="82" cy="27" r="5" fill="#0F172A" />
      <circle cx="95" cy="30" r="1" fill="#0F172A" />

      {/* --- FLOATING DECORATIONS --- */}
      {/* 100% Verified Badge */}
      <g transform="translate(160, 16)">
        <rect x="0" y="0" width="86" height="20" rx="10" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.6" />
        <circle cx="10" cy="10" r="4.5" fill="#0F172A" />
        <path d="M8 10 L9.5 11.5 L12.5 8.5" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
        <text x="18" y="13.5" fill="#0F172A" fontSize="8" fontWeight="bold" fontFamily="sans-serif">100% Grounded</text>
      </g>

      {/* Sparkles */}
      <path d="M260 35 L262 40 L267 42 L262 44 L260 49 L258 44 L253 42 L258 40 Z" fill="#0F172A" />
      <path d="M60 45 L61.5 48.5 L65 50 L61.5 51.5 L60 55 L58.5 51.5 L55 50 L58.5 48.5 Z" fill="#0F172A" />
      <circle cx="310" cy="110" r="2.5" fill="#0F172A" />
    </svg>
  );
};
