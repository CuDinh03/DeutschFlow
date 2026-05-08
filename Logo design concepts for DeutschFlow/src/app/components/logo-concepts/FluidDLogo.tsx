import { motion } from "motion/react";

export function FluidDLogo({ className = "", size = 120 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={className}
      fill="none"
    >
      {/* Glassmorphism background */}
      <defs>
        <linearGradient id="fluidGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#DA291C', stopOpacity: 0.85 }} />
          <stop offset="50%" style={{ stopColor: '#FFCD00', stopOpacity: 0.75 }} />
          <stop offset="100%" style={{ stopColor: '#4F46E5', stopOpacity: 0.8 }} />
        </linearGradient>
        <filter id="glass-blur">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
        </filter>
      </defs>

      {/* Vietnamese star accent (subtle) */}
      <motion.path
        d="M 100 95 L 103 105 L 113 105 L 105 111 L 108 121 L 100 115 L 92 121 L 95 111 L 87 105 L 97 105 Z"
        fill="#FFCD00"
        fillOpacity="0.3"
        initial={{ scale: 0, rotate: 0 }}
        animate={{ scale: [0, 1.2, 1], rotate: [0, 180, 360] }}
        transition={{ duration: 2, delay: 1.5 }}
      />

      {/* Main fluid D shape */}
      <motion.path
        d="M 50 40 C 50 40, 80 35, 110 40 C 140 45, 150 70, 150 100 C 150 130, 140 155, 110 160 C 80 165, 50 160, 50 160 Z"
        stroke="url(#fluidGradient)"
        strokeWidth="8"
        fill="url(#fluidGradient)"
        fillOpacity="0.15"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 2, ease: "easeInOut" }}
        style={{ filter: 'drop-shadow(0 4px 20px rgba(79, 70, 229, 0.3))' }}
      />

      {/* AI pixel particles dissolving from the top */}
      {[...Array(12)].map((_, i) => (
        <motion.circle
          key={i}
          cx={110 + (i % 4) * 8}
          cy={30 + Math.floor(i / 4) * 8}
          r={2}
          fill="url(#fluidGradient)"
          initial={{ opacity: 0, scale: 0, y: 20 }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0, 1, 0.5],
            y: [20, 0, -10]
          }}
          transition={{
            duration: 2,
            delay: 0.5 + i * 0.1,
            repeat: Infinity,
            repeatDelay: 1
          }}
        />
      ))}

      {/* Inner glow effect */}
      <motion.path
        d="M 60 50 C 60 50, 85 47, 105 50 C 125 53, 135 75, 135 100 C 135 125, 125 147, 105 150 C 85 153, 60 150, 60 150 Z"
        stroke="white"
        strokeWidth="2"
        fill="none"
        opacity="0.4"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 3, repeat: Infinity }}
      />
    </svg>
  );
}
