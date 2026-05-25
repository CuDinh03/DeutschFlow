import { motion } from "motion/react";
import { useState } from "react";

type PersonaColor = 'lukas' | 'klaus' | 'hanna';

const personaColors = {
  lukas: { primary: '#4F46E5', secondary: '#818CF8' }, // Indigo (Germany tech)
  klaus: { primary: '#DA291C', secondary: '#FF4444' }, // Vietnam Red
  hanna: { primary: '#FFCD00', secondary: '#FFE066' }, // Vietnam Gold
};

export function PersonaMentorLogo({
  className = "",
  size = 120,
  persona = 'lukas'
}: {
  className?: string;
  size?: number;
  persona?: PersonaColor;
}) {
  const colors = personaColors[persona];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={className}
      fill="none"
    >
      <defs>
        <linearGradient id={`personaGradient-${persona}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: colors.primary, stopOpacity: 0.8 }} />
          <stop offset="100%" style={{ stopColor: colors.secondary, stopOpacity: 0.9 }} />
        </linearGradient>
      </defs>

      {/* Abstract head/crown shape combining D with Vietnamese conical hat inspiration */}
      <motion.path
        d="M 100 40 L 120 60 L 140 50 L 150 70 L 140 90 C 140 90, 130 100, 100 100 C 70 100, 60 90, 60 90 L 50 70 L 60 50 L 80 60 Z"
        fill={`url(#personaGradient-${persona})`}
        fillOpacity="0.2"
        stroke={`url(#personaGradient-${persona})`}
        strokeWidth="3"
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ duration: 1, type: "spring" }}
        style={{ filter: `drop-shadow(0 4px 20px ${colors.primary}40)` }}
      />

      {/* Vietnamese traditional pattern accent */}
      <motion.path
        d="M 90 50 Q 100 45 110 50"
        stroke={colors.secondary}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 1.2, duration: 0.8 }}
        opacity="0.4"
      />

      {/* D letter integrated into design */}
      <motion.path
        d="M 70 80 C 70 80, 70 70, 70 60 C 70 50, 75 45, 85 45 C 95 45, 105 50, 105 60 C 105 70, 105 120, 105 130 C 105 140, 95 145, 85 145 C 75 145, 70 140, 70 130 C 70 120, 70 90, 70 80 Z"
        fill="none"
        stroke={colors.primary}
        strokeWidth="5"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.5, delay: 0.3 }}
      />

      {/* Soundwave emanating from the side */}
      {[0, 1, 2, 3].map((i) => (
        <motion.path
          key={i}
          d={`M ${120 + i * 15} 95 Q ${125 + i * 15} ${90 - i * 3} ${130 + i * 15} 95 Q ${125 + i * 15} ${100 + i * 3} ${120 + i * 15} 105`}
          stroke={colors.secondary}
          strokeWidth="2.5"
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{
            pathLength: 1,
            opacity: [0, 0.7, 0],
          }}
          transition={{
            duration: 2,
            delay: 0.8 + i * 0.2,
            repeat: Infinity,
            repeatDelay: 0.5
          }}
        />
      ))}

      {/* Glassmorphism overlay circle */}
      <motion.circle
        cx="100"
        cy="100"
        r="75"
        fill="none"
        stroke="rgba(255, 255, 255, 0.3)"
        strokeWidth="1.5"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 1 }}
      />
    </svg>
  );
}

// Interactive version with persona switching
export function InteractivePersonaLogo({
  className = "",
  size = 120
}: {
  className?: string;
  size?: number;
}) {
  const [persona, setPersona] = useState<PersonaColor>('lukas');

  return (
    <div className="flex flex-col items-center gap-4">
      <PersonaMentorLogo className={className} size={size} persona={persona} />
      <div className="flex gap-2">
        <button
          onClick={() => setPersona('lukas')}
          className="px-3 py-1 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 transition-colors"
        >
          Lukas 🇩🇪
        </button>
        <button
          onClick={() => setPersona('klaus')}
          className="px-3 py-1 rounded-lg bg-[#DA291C] text-white text-sm hover:bg-red-700 transition-colors"
        >
          Klaus 🇻🇳
        </button>
        <button
          onClick={() => setPersona('hanna')}
          className="px-3 py-1 rounded-lg bg-[#FFCD00] text-slate-900 text-sm hover:bg-yellow-500 transition-colors"
        >
          Hanna 🇻🇳
        </button>
      </div>
    </div>
  );
}
