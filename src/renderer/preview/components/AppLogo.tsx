import React from 'react';

interface AppLogoProps {
  size?: number;
  className?: string;
}

export const AppLogo: React.FC<AppLogoProps> = ({ size = 24, className = '' }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={className}
      fill="none"
    >
      <defs>
        {/* Background Gradients */}
        <radialGradient id="logoBgGlow" cx="50%" cy="45%" r="65%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="60%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#020617" />
        </radialGradient>

        <linearGradient id="logoRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="50%" stopColor="#0284c7" />
          <stop offset="100%" stopColor="#0369a1" />
        </linearGradient>

        <linearGradient id="logoArcGrad" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="35%" stopColor="#7dd3fc" />
          <stop offset="70%" stopColor="#00f0ff" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>

        <filter id="logoElectricGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur1" />
          <feGaussianBlur in="SourceGraphic" stdDeviation="18" result="blur2" />
          <feMerge>
            <feMergeNode in="blur2" />
            <feMergeNode in="blur1" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Circular Base */}
      <circle
        cx="256"
        cy="256"
        r="236"
        fill="url(#logoBgGlow)"
        stroke="url(#logoRingGrad)"
        strokeWidth="16"
      />

      {/* Subtle Inner Ring */}
      <circle
        cx="256"
        cy="256"
        r="220"
        fill="none"
        stroke="#38bdf8"
        strokeWidth="4"
        strokeOpacity="0.3"
        strokeDasharray="14 10"
      />

      {/* MD Letters: M and D with technical typography */}
      <g
        fill="#f8fafc"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        fontWeight="900"
        fontSize="170"
        letterSpacing="-6"
      >
        {/* Letter M (Left) */}
        <text x="135" y="320" textAnchor="middle" fill="#f1f5f9" opacity="0.95">
          M
        </text>
        {/* Letter D (Right) */}
        <text x="375" y="320" textAnchor="middle" fill="#38bdf8" opacity="0.95">
          D
        </text>
      </g>

      {/* Center Electric Arc Lightning Bolt */}
      <g filter="url(#logoElectricGlow)">
        {/* Outer cyan glow bolt */}
        <path
          d="M 275 60
             L 215 220
             L 265 225
             L 205 380
             L 245 375
             L 195 460
             L 305 280
             L 255 275
             L 320 150
             Z"
          fill="url(#logoArcGrad)"
        />

        {/* Pure White Core Energy Discharge */}
        <path
          d="M 270 75
             L 223 218
             L 267 223
             L 214 370
             L 245 366
             L 210 440
             L 295 285
             L 253 280
             L 310 158
             Z"
          fill="#ffffff"
          opacity="0.9"
        />
      </g>

      {/* Plasma Arc Branch Discharges */}
      <circle cx="280" cy="70" r="7" fill="#ffffff" filter="url(#logoElectricGlow)" />
      <path
        d="M 285 220 L 330 200 L 315 235"
        fill="none"
        stroke="#00f0ff"
        strokeWidth="6"
        strokeLinecap="round"
        filter="url(#logoElectricGlow)"
      />
      <path
        d="M 235 320 L 190 340 L 205 310"
        fill="none"
        stroke="#7dd3fc"
        strokeWidth="6"
        strokeLinecap="round"
        filter="url(#logoElectricGlow)"
      />
      <circle cx="200" cy="450" r="6" fill="#ffffff" filter="url(#logoElectricGlow)" />
    </svg>
  );
};
