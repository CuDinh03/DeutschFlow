import { motion } from "motion/react";

export function GlassBubbleLogo({ className = "", size = 120 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={className}
      fill="none"
    >
      <defs>
        <linearGradient id="bubbleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#DA291C', stopOpacity: 0.6 }} />
          <stop offset="50%" style={{ stopColor: '#FFCD00', stopOpacity: 0.5 }} />
          <stop offset="100%" style={{ stopColor: '#4F46E5', stopOpacity: 0.6 }} />
        </linearGradient>
        <filter id="bubble-glass">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1" />
        </filter>

        {/* Lotus pattern for Vietnamese touch */}
        <pattern id="lotusPattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 20 10 Q 15 15 20 20 Q 25 15 20 10 Z" fill="#FFCD00" fillOpacity="0.1" />
        </pattern>
      </defs>

      {/* Background bubble (larger) */}
      <motion.circle
        cx="100"
        cy="100"
        r="70"
        fill="url(#bubbleGradient)"
        fillOpacity="0.2"
        stroke="rgba(255, 255, 255, 0.4)"
        strokeWidth="2"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        style={{
          backdropFilter: 'blur(10px)',
          filter: 'drop-shadow(0 8px 32px rgba(79, 70, 229, 0.2))'
        }}
      />

      {/* Dual flag stripes - Vietnam (red top) + Germany (black/red/gold bottom) */}
      <motion.rect
        x="50"
        y="70"
        width="100"
        height="12"
        fill="#DA291C"
        opacity="0.25"
        rx="2"
        initial={{ x: 100 }}
        animate={{ x: 50 }}
        transition={{ delay: 0.5, duration: 0.6 }}
      />

      {/* Vietnamese star in red stripe */}
      <motion.path
        d="M 100 74 L 101.5 78 L 105.5 78 L 102.5 80.5 L 103.5 84.5 L 100 82 L 96.5 84.5 L 97.5 80.5 L 94.5 78 L 98.5 78 Z"
        fill="#FFCD00"
        fillOpacity="0.6"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.8, type: "spring" }}
      />

      {/* German stripes */}
      <motion.rect
        x="50"
        y="100"
        width="100"
        height="8"
        fill="black"
        opacity="0.15"
        rx="2"
        initial={{ x: 100 }}
        animate={{ x: 50 }}
        transition={{ delay: 0.6, duration: 0.6 }}
      />
      <motion.rect
        x="50"
        y="113"
        width="100"
        height="8"
        fill="#DD0000"
        opacity="0.2"
        rx="2"
        initial={{ x: 100 }}
        animate={{ x: 50 }}
        transition={{ delay: 0.65, duration: 0.6 }}
      />
      <motion.rect
        x="50"
        y="126"
        width="100"
        height="8"
        fill="#FFCC00"
        opacity="0.2"
        rx="2"
        initial={{ x: 100 }}
        animate={{ x: 50 }}
        transition={{ delay: 0.7, duration: 0.6 }}
      />

      {/* Foreground bubble (smaller, overlapping) */}
      <motion.circle
        cx="130"
        cy="80"
        r="45"
        fill="url(#bubbleGradient)"
        fillOpacity="0.15"
        stroke="rgba(255, 255, 255, 0.5)"
        strokeWidth="2"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
        style={{
          filter: 'drop-shadow(0 4px 20px rgba(153, 27, 27, 0.2))'
        }}
      />

      {/* Speech bubble tail */}
      <motion.path
        d="M 85 155 L 75 175 L 95 160 Z"
        fill="url(#bubbleGradient)"
        fillOpacity="0.2"
        stroke="rgba(255, 255, 255, 0.4)"
        strokeWidth="2"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.5 }}
      />

      {/* Highlight spots for glass effect */}
      <motion.ellipse
        cx="80"
        cy="70"
        rx="20"
        ry="15"
        fill="white"
        opacity="0.25"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.25 }}
        transition={{ delay: 1 }}
      />
      <motion.ellipse
        cx="140"
        cy="65"
        rx="12"
        ry="10"
        fill="white"
        opacity="0.3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.3 }}
        transition={{ delay: 1.1 }}
      />
    </svg>
  );
}
