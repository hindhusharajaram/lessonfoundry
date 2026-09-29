import React from 'react';

interface IllustrationProps {
  className?: string;
}

export const TeacherIllustration: React.FC<IllustrationProps> = ({ className = 'w-full h-auto' }) => {
  return (
    <svg
      viewBox="0 0 520 440"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Teacher Studio Illustration"
    >
      {/* Soft shadow under base */}
      <ellipse cx="260" cy="405" rx="200" ry="12" fill="#0F172A" fillOpacity="0.12" />

      {/* --- RIGHT BACKGROUND POTTED PLANT --- */}
      {/* Plant Pot */}
      <path
        d="M395 330 L385 400 Q385 405 405 405 L435 405 Q455 405 455 400 L445 330 Z"
        fill="#0F172A"
      />
      {/* Plant Leaves */}
      <path
        d="M420 330 Q430 260 480 250 Q455 295 420 330 Z"
        fill="#FFFFFF"
        stroke="#0F172A"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M430 310 Q450 280 470 260" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M415 330 Q395 240 455 210 Q435 265 415 330 Z"
        fill="#FFFFFF"
        stroke="#0F172A"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M420 295 Q425 260 445 235" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M410 330 Q370 270 355 240 Q390 280 410 330 Z"
        fill="#FFFFFF"
        stroke="#0F172A"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* --- CENTRAL EVIDENCE-LOCKED LESSON PACK DOCUMENT --- */}
      {/* Document Shadow */}
      <rect x="195" y="115" width="180" height="260" rx="14" fill="#0F172A" fillOpacity="0.15" />
      {/* Document Main Card */}
      <rect
        x="185"
        y="105"
        width="180"
        height="260"
        rx="14"
        fill="#FFFFFF"
        stroke="#0F172A"
        strokeWidth="2.5"
      />

      {/* Document Header Bar */}
      <rect x="202" y="125" width="85" height="12" rx="4" fill="#0F172A" />
      <rect x="295" y="127" width="52" height="8" rx="3" fill="#CBD5E1" />

      {/* Section 1: Objective & Evidence Checklist */}
      <circle cx="210" cy="160" r="7" fill="#0F172A" />
      <path d="M207 160 L209 162 L213 158" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="225" y1="157" x2="335" y2="157" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" />
      <line x1="225" y1="166" x2="310" y2="166" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />

      {/* Section 2: Verbatim Evidence Quote Box */}
      <rect x="203" y="185" width="144" height="42" rx="8" fill="#F8FAFC" stroke="#0F172A" strokeWidth="1.5" strokeDasharray="4 3" />
      <text x="212" y="202" fill="#0F172A" fontSize="13" fontWeight="bold" fontFamily="sans-serif">“</text>
      <line x1="224" y1="198" x2="335" y2="198" stroke="#64748B" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="212" y1="212" x2="320" y2="212" stroke="#64748B" strokeWidth="2.5" strokeLinecap="round" />

      {/* Section 3: Another Approved Item */}
      <circle cx="210" cy="248" r="7" fill="#0F172A" />
      <path d="M207 248 L209 250 L213 246" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="225" y1="245" x2="345" y2="245" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" />
      <line x1="225" y1="254" x2="295" y2="254" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />

      {/* Section 4: Practice Rows */}
      <circle cx="210" cy="278" r="6" stroke="#0F172A" strokeWidth="2" fill="#FFFFFF" />
      <line x1="225" y1="278" x2="330" y2="278" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />

      <circle cx="210" cy="304" r="6" stroke="#0F172A" strokeWidth="2" fill="#FFFFFF" />
      <line x1="225" y1="304" x2="315" y2="304" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />

      {/* Approved Stamp Badge on Document bottom right */}
      <g transform="translate(270, 320)">
        <rect x="0" y="0" width="80" height="24" rx="12" fill="#0F172A" />
        <path d="M12 12 L15 15 L21 9" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <text x="26" y="16" fill="#FFFFFF" fontSize="9" fontWeight="bold" fontFamily="sans-serif" letterSpacing="0.5">APPROVED</text>
      </g>

      {/* Large Evidence Verifier Magnifying Glass (Echoing the reference image's large circle element) */}
      <g transform="translate(145, 175)">
        {/* Shadow */}
        <circle cx="55" cy="55" r="38" fill="#0F172A" fillOpacity="0.1" />
        {/* Glass Rim */}
        <circle cx="52" cy="52" r="36" fill="#FFFFFF" stroke="#0F172A" strokeWidth="3" />
        <circle cx="52" cy="52" r="28" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.5" strokeDasharray="3 3" />
        {/* Verification Check inside lens */}
        <path d="M42 52 L49 59 L64 44" stroke="#0F172A" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Lens Glare */}
        <path d="M36 38 A 22 22 0 0 1 66 34" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" />
        {/* Handle */}
        <path d="M78 78 L98 98" stroke="#0F172A" strokeWidth="6" strokeLinecap="round" />
        <path d="M78 78 L98 98" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
      </g>

      {/* --- TEACHER FIGURE (Standing on Left) --- */}
      {/* Shadow */}
      <ellipse cx="108" cy="402" rx="34" ry="7" fill="#0F172A" fillOpacity="0.18" />

      {/* Teacher Back Leg */}
      <path d="M102 295 L95 385" stroke="#0F172A" strokeWidth="2.5" />
      <path d="M112 295 L110 385" stroke="#0F172A" strokeWidth="2.5" />
      {/* Back Shoe */}
      <path d="M92 385 L114 385 L116 397 L88 397 Q88 387 92 385 Z" fill="#0F172A" />

      {/* Teacher Front Leg */}
      <path d="M118 295 L126 388" stroke="#0F172A" strokeWidth="2.5" />
      <path d="M130 295 L140 388" stroke="#0F172A" strokeWidth="2.5" />
      {/* Front Shoe */}
      <path d="M124 388 L146 388 L152 400 L120 400 Q120 390 124 388 Z" fill="#0F172A" />

      {/* Teacher Torso / Blazer */}
      <path
        d="M96 175 L132 170 L142 295 L94 295 Z"
        fill="#FFFFFF"
        stroke="#0F172A"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Lapels & Collar */}
      <path d="M108 173 L116 230 L128 171" stroke="#0F172A" strokeWidth="2" fill="#F8FAFC" />
      <line x1="116" y1="230" x2="116" y2="295" stroke="#0F172A" strokeWidth="1.5" />
      <circle cx="116" cy="250" r="2" fill="#0F172A" />
      <circle cx="116" cy="270" r="2" fill="#0F172A" />

      {/* Left Arm / Hand pointing toward the document */}
      <path
        d="M130 185 Q155 200 178 185"
        stroke="#0F172A"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Hand Gesture */}
      <path
        d="M178 185 Q184 182 188 185 Q184 190 177 189"
        fill="#FFFFFF"
        stroke="#0F172A"
        strokeWidth="2"
      />

      {/* Right Arm holding Teaching Tablet / Folder */}
      <path
        d="M100 185 L84 235 L106 250"
        stroke="#0F172A"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Tablet held by teacher */}
      <rect
        x="72"
        y="230"
        width="32"
        height="44"
        rx="5"
        transform="rotate(-15 72 230)"
        fill="#FFFFFF"
        stroke="#0F172A"
        strokeWidth="2.2"
      />
      {/* Screen details on tablet */}
      <rect
        x="76"
        y="236"
        width="24"
        height="32"
        rx="3"
        transform="rotate(-15 76 236)"
        fill="#0F172A"
      />
      {/* Sparkle on tablet screen */}
      <path
        d="M87 245 L89 249 L93 251 L89 253 L87 257 L85 253 L81 251 L85 249 Z"
        fill="#FFFFFF"
      />

      {/* Teacher Neck */}
      <path d="M110 155 L110 173 L120 173 L120 155" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2" />

      {/* Teacher Head Profile */}
      <ellipse cx="116" cy="138" rx="14" ry="16" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2.5" />
      {/* Stylish Hair (Black fill matching reference) */}
      <path
        d="M102 138 C100 120 115 116 128 122 C132 125 133 134 130 140 C126 130 118 126 106 134 Z"
        fill="#0F172A"
      />
      {/* Hair Bun / Back detail */}
      <circle cx="102" cy="134" r="7" fill="#0F172A" />
      {/* Minimalist Glasses */}
      <rect x="118" y="134" width="11" height="8" rx="2" fill="none" stroke="#0F172A" strokeWidth="1.8" />
      <line x1="113" y1="137" x2="118" y2="137" stroke="#0F172A" strokeWidth="1.8" />
      {/* Eye & Nose */}
      <circle cx="123" cy="138" r="1.2" fill="#0F172A" />
      <path d="M128 139 L132 143 L128 145" stroke="#0F172A" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M124 148 Q127 150 129 148" stroke="#0F172A" strokeWidth="1.5" strokeLinecap="round" fill="none" />

      {/* --- FLOATING ACCENTS --- */}
      {/* Evidence Badge top left */}
      <g transform="translate(190, 68)">
        <rect x="0" y="0" width="110" height="26" rx="13" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2" />
        <circle cx="14" cy="13" r="6" fill="#0F172A" />
        <path d="M11 13 L13 15 L17 11" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <text x="26" y="17" fill="#0F172A" fontSize="9" fontWeight="bold" fontFamily="sans-serif">Evidence Locked</text>
      </g>

      {/* Sparkle Stars */}
      <path d="M370 85 L373 93 L381 96 L373 99 L370 107 L367 99 L359 96 L367 93 Z" fill="#0F172A" />
      <path d="M85 95 L87 101 L93 103 L87 105 L85 111 L83 105 L77 103 L83 101 Z" fill="#0F172A" />
      <circle cx="470" cy="170" r="3" fill="#0F172A" />
    </svg>
  );
};
