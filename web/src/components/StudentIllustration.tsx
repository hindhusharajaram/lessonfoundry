import React from 'react';

interface IllustrationProps {
  className?: string;
}

export const StudentIllustration: React.FC<IllustrationProps> = ({ className = 'w-full h-auto' }) => {
  return (
    <svg
      viewBox="0 0 520 440"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Student Portal Illustration"
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

      {/* --- CENTRAL STUDENT QUIZ & PRACTICE DOCUMENT --- */}
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
      <rect x="202" y="125" width="75" height="12" rx="4" fill="#0F172A" />
      <rect x="285" y="127" width="62" height="8" rx="3" fill="#CBD5E1" />

      {/* Question 1 Prompt */}
      <line x1="205" y1="155" x2="330" y2="155" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" />
      <line x1="205" y1="166" x2="285" y2="166" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />

      {/* Multiple Choice Options */}
      {/* Option A (Normal) */}
      <circle cx="212" cy="188" r="6" stroke="#0F172A" strokeWidth="2" fill="#FFFFFF" />
      <line x1="226" y1="188" x2="315" y2="188" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />

      {/* Option B (Selected & Correct) */}
      <circle cx="212" cy="208" r="6" fill="#0F172A" />
      <path d="M209 208 L211 210 L215 206" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="226" y1="208" x2="335" y2="208" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" />

      {/* Option C (Normal) */}
      <circle cx="212" cy="228" r="6" stroke="#0F172A" strokeWidth="2" fill="#FFFFFF" />
      <line x1="226" y1="228" x2="295" y2="228" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />

      {/* Practice Question 2 Box */}
      <rect x="203" y="248" width="144" height="52" rx="8" fill="#F8FAFC" stroke="#0F172A" strokeWidth="1.5" />
      <line x1="214" y1="262" x2="334" y2="262" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="214" y1="274" x2="310" y2="274" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
      <circle cx="218" cy="289" r="4" fill="#0F172A" />
      <circle cx="230" cy="289" r="4" stroke="#0F172A" strokeWidth="1.5" fill="#FFFFFF" />
      <circle cx="242" cy="289" r="4" stroke="#0F172A" strokeWidth="1.5" fill="#FFFFFF" />

      {/* Large Lens Element inspecting practice question (Echoing reference composition) */}
      <g transform="translate(145, 175)">
        <circle cx="55" cy="55" r="38" fill="#0F172A" fillOpacity="0.1" />
        <circle cx="52" cy="52" r="36" fill="#FFFFFF" stroke="#0F172A" strokeWidth="3" />
        <circle cx="52" cy="52" r="28" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.5" strokeDasharray="3 3" />
        {/* Star Icon inside lens */}
        <path d="M52 42 L55 49 L62 50 L57 55 L58 62 L52 58 L46 62 L47 55 L42 50 L49 49 Z" fill="#0F172A" />
        {/* Handle */}
        <path d="M78 78 L98 98" stroke="#0F172A" strokeWidth="6" strokeLinecap="round" />
        <path d="M78 78 L98 98" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
      </g>

      {/* --- FIGURE 1: STUDENT SITTING ON TOP OF DOCUMENT (Matching Reference) --- */}
      {/* Student Torso */}
      <path
        d="M290 85 L324 80 L334 115 L286 115 Z"
        fill="#FFFFFF"
        stroke="#0F172A"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Neck & Head */}
      <rect x="302" y="74" width="8" height="12" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2" />
      <ellipse cx="306" cy="62" rx="13" ry="14" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2.5" />
      {/* Hair (Black cap style matching reference) */}
      <path
        d="M294 62 C292 48 305 45 316 50 C322 53 322 62 318 66 C314 56 308 53 298 59 Z"
        fill="#0F172A"
      />
      <circle cx="312" cy="62" r="1.3" fill="#0F172A" />
      <path d="M315 65 L318 67 L315 69" stroke="#0F172A" strokeWidth="1.4" strokeLinecap="round" fill="none" />

      {/* Sitting Legs dangling down the right */}
      {/* Thigh (horizontal across document top) */}
      <path d="M290 115 L350 115 L352 135 L290 135 Z" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2.5" />
      {/* Lower Legs (angled down toward plant) */}
      <path d="M340 135 L368 200 L354 204 L330 135" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2.5" />
      <path d="M350 135 L382 195 L370 200 L342 135" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2" />
      {/* Black Shoes */}
      <path d="M362 200 L388 202 L390 214 L356 210 Z" fill="#0F172A" />
      <path d="M378 195 L404 197 L406 208 L374 204 Z" fill="#0F172A" />

      {/* Arms holding Laptop on lap */}
      <path d="M320 90 L335 110 L315 114" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* Open Laptop */}
      <g transform="translate(325, 88)">
        {/* Base */}
        <polygon points="0,24 24,24 20,28 -4,28" fill="#0F172A" />
        {/* Screen */}
        <path d="M22 24 L32 4 L14 4 L6 24 Z" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2" strokeLinejoin="round" />
        <polygon points="20,22 28,7 16,7 10,22" fill="#0F172A" />
      </g>

      {/* --- FIGURE 2: STUDENT STANDING / WALKING ON LEFT --- */}
      {/* Shadow */}
      <ellipse cx="112" cy="402" rx="34" ry="7" fill="#0F172A" fillOpacity="0.18" />

      {/* Back Leg */}
      <path d="M106 295 L98 385" stroke="#0F172A" strokeWidth="2.5" />
      <path d="M116 295 L112 385" stroke="#0F172A" strokeWidth="2.5" />
      <path d="M95 385 L117 385 L119 397 L91 397 Q91 387 95 385 Z" fill="#0F172A" />

      {/* Front Walking Leg */}
      <path d="M122 295 L132 388" stroke="#0F172A" strokeWidth="2.5" />
      <path d="M134 295 L146 388" stroke="#0F172A" strokeWidth="2.5" />
      <path d="M130 388 L152 388 L158 400 L126 400 Q126 390 130 388 Z" fill="#0F172A" />

      {/* Student Torso */}
      <path
        d="M100 180 L134 175 L144 295 L98 295 Z"
        fill="#FFFFFF"
        stroke="#0F172A"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Backpack on back */}
      <path
        d="M98 188 C88 195 86 230 96 250 L100 250 Z"
        fill="#FFFFFF"
        stroke="#0F172A"
        strokeWidth="2.5"
      />
      <path d="M102 195 L102 245" stroke="#0F172A" strokeWidth="2" strokeDasharray="3 3" />

      {/* Arms holding Mobile/Mini Tablet reviewing notes */}
      <path
        d="M130 190 L146 225 L125 235"
        stroke="#0F172A"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M112 190 L128 226"
        stroke="#0F172A"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Mobile Device */}
      <rect
        x="132"
        y="218"
        width="16"
        height="26"
        rx="4"
        transform="rotate(15 132 218)"
        fill="#0F172A"
      />
      <rect
        x="134"
        y="222"
        width="12"
        height="18"
        rx="2"
        transform="rotate(15 134 222)"
        fill="#FFFFFF"
      />

      {/* Neck & Head */}
      <path d="M114 158 L114 176 L124 176 L124 158" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2" />
      <ellipse cx="120" cy="142" rx="14" ry="16" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2.5" />
      {/* Short Modern Hair */}
      <path
        d="M106 142 C104 124 119 120 132 126 C136 129 137 138 134 144 C130 134 122 130 110 138 Z"
        fill="#0F172A"
      />
      <circle cx="127" cy="142" r="1.3" fill="#0F172A" />
      <path d="M131 143 L135 147 L131 149" stroke="#0F172A" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M128 152 Q131 154 133 152" stroke="#0F172A" strokeWidth="1.5" strokeLinecap="round" fill="none" />

      {/* --- FLOATING ACCENTS --- */}
      {/* Score Pill Badge top left */}
      <g transform="translate(190, 68)">
        <rect x="0" y="0" width="105" height="26" rx="13" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2" />
        <circle cx="14" cy="13" r="6" fill="#0F172A" />
        <path d="M11 13 L13 15 L17 11" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <text x="26" y="17" fill="#0F172A" fontSize="9" fontWeight="bold" fontFamily="sans-serif">Score: 100%</text>
      </g>

      {/* Sparkles */}
      <path d="M370 85 L373 93 L381 96 L373 99 L370 107 L367 99 L359 96 L367 93 Z" fill="#0F172A" />
      <path d="M85 95 L87 101 L93 103 L87 105 L85 111 L83 105 L77 103 L83 101 Z" fill="#0F172A" />
      <circle cx="470" cy="170" r="3" fill="#0F172A" />
    </svg>
  );
};
