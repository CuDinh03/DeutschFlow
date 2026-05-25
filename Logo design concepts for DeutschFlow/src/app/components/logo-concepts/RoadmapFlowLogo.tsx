import { motion } from "motion/react";

export function RoadmapFlowLogo({ className = "", size = 120 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={className}
      fill="none"
    >
      <defs>
        <linearGradient id="roadmapGradient" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" style={{ stopColor: '#DA291C', stopOpacity: 0.9 }} />
          <stop offset="50%" style={{ stopColor: '#FFCD00', stopOpacity: 0.85 }} />
          <stop offset="100%" style={{ stopColor: '#4F46E5', stopOpacity: 0.8 }} />
        </linearGradient>

        {/* Vietnamese decorative pattern */}
        <pattern id="vnPattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="10" cy="10" r="1" fill="#FFCD00" fillOpacity="0.15" />
        </pattern>
      </defs>

      {/* Solid D block */}
      <motion.path
        d="M 50 60 L 50 140 L 85 140 C 110 140, 130 125, 130 100 C 130 75, 110 60, 85 60 Z"
        fill="url(#roadmapGradient)"
        fillOpacity="0.25"
        stroke="url(#roadmapGradient)"
        strokeWidth="4"
        initial={{ x: -50, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.8 }}
        style={{ filter: 'drop-shadow(0 4px 16px rgba(79, 70, 229, 0.3))' }}
      />

      {/* Extended f/arrow cutting through */}
      <motion.path
        d="M 100 130 L 100 90 L 140 90 M 100 70 L 100 40 L 100 30"
        stroke="url(#roadmapGradient)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.5, delay: 0.5 }}
      />

      {/* Arrow head */}
      <motion.path
        d="M 100 30 L 90 45 M 100 30 L 110 45"
        stroke="url(#roadmapGradient)"
        strokeWidth="6"
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.5, delay: 2 }}
      />

      {/* Roadmap milestone nodes */}
      {[
        { y: 120, delay: 0.8 },
        { y: 95, delay: 1.2 },
        { y: 70, delay: 1.6 },
        { y: 45, delay: 2.0 },
      ].map((node, i) => (
        <motion.g key={i}>
          {/* Node circle */}
          <motion.circle
            cx="100"
            cy={node.y}
            r="6"
            fill="white"
            stroke="url(#roadmapGradient)"
            strokeWidth="3"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: node.delay, type: "spring", stiffness: 300 }}
          />

          {/* Pulse effect */}
          <motion.circle
            cx="100"
            cy={node.y}
            r="6"
            fill="none"
            stroke="url(#roadmapGradient)"
            strokeWidth="2"
            initial={{ scale: 1, opacity: 0 }}
            animate={{
              scale: [1, 2.5],
              opacity: [0.6, 0]
            }}
            transition={{
              delay: node.delay + 0.3,
              duration: 1.5,
              repeat: Infinity,
              repeatDelay: 2
            }}
          />
        </motion.g>
      ))}

      {/* Glass overlay effect with Vietnamese pattern */}
      <motion.rect
        x="50"
        y="60"
        width="100"
        height="80"
        fill="url(#vnPattern)"
        opacity="0.15"
        rx="8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.15 }}
        transition={{ delay: 2.5 }}
      />

      {/* Small Vietnamese star accent */}
      <motion.path
        d="M 70 150 L 72 155 L 77 155 L 73 158 L 75 163 L 70 160 L 65 163 L 67 158 L 63 155 L 68 155 Z"
        fill="#FFCD00"
        fillOpacity="0.5"
        initial={{ scale: 0, rotate: 0 }}
        animate={{ scale: 1, rotate: 360 }}
        transition={{ delay: 2.8, duration: 1 }}
      />
    </svg>
  );
}
