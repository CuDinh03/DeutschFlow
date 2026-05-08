import { motion } from "motion/react";

export function CircuitSystemLogo({ className = "", size = 120 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={className}
      fill="none"
    >
      <defs>
        <linearGradient id="circuitGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#DA291C', stopOpacity: 0.9 }} />
          <stop offset="100%" style={{ stopColor: '#FFCD00', stopOpacity: 0.9 }} />
        </linearGradient>

        {/* Circuit board pattern */}
        <pattern id="circuitPattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 0 20 L 20 20 M 20 0 L 20 40" stroke="#000000" strokeWidth="1" opacity="0.1" />
        </pattern>
      </defs>

      {/* Circuit board background */}
      <motion.rect
        x="40"
        y="40"
        width="120"
        height="120"
        fill="url(#circuitPattern)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      />

      {/* Main D circuit path */}
      <motion.path
        d="M 70 70 L 70 130 L 100 130 C 120 130 130 120 130 100 C 130 80 120 70 100 70 Z"
        fill="none"
        stroke="#000000"
        strokeWidth="5"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 2, ease: "easeInOut" }}
      />

      {/* Circuit traces - horizontal */}
      <motion.path
        d="M 50 100 L 70 100"
        stroke="#DA291C"
        strokeWidth="3"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.5, duration: 0.6 }}
      />

      <motion.path
        d="M 130 90 L 150 90"
        stroke="#FFCD00"
        strokeWidth="3"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.7, duration: 0.6 }}
      />

      <motion.path
        d="M 130 110 L 150 110"
        stroke="#FFCD00"
        strokeWidth="3"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.9, duration: 0.6 }}
      />

      {/* Logic nodes - red */}
      {[
        { x: 70, y: 70, delay: 1.2 },
        { x: 70, y: 100, delay: 1.3 },
        { x: 70, y: 130, delay: 1.4 }
      ].map((node, i) => (
        <motion.g key={`red-${i}`}>
          <motion.circle
            cx={node.x}
            cy={node.y}
            r="5"
            fill="#DA291C"
            stroke="#000000"
            strokeWidth="2"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: node.delay, type: "spring", stiffness: 300 }}
          />
          {/* Pulse effect */}
          <motion.circle
            cx={node.x}
            cy={node.y}
            r="5"
            fill="none"
            stroke="#DA291C"
            strokeWidth="2"
            animate={{
              scale: [1, 2, 1],
              opacity: [0.8, 0, 0.8]
            }}
            transition={{
              delay: node.delay + 0.5,
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        </motion.g>
      ))}

      {/* Logic nodes - yellow */}
      {[
        { x: 130, y: 80, delay: 1.5 },
        { x: 130, y: 100, delay: 1.6 },
        { x: 130, y: 120, delay: 1.7 }
      ].map((node, i) => (
        <motion.g key={`yellow-${i}`}>
          <motion.circle
            cx={node.x}
            cy={node.y}
            r="5"
            fill="#FFCD00"
            stroke="#000000"
            strokeWidth="2"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: node.delay, type: "spring", stiffness: 300 }}
          />
          {/* Pulse effect */}
          <motion.circle
            cx={node.x}
            cy={node.y}
            r="5"
            fill="none"
            stroke="#FFCD00"
            strokeWidth="2"
            animate={{
              scale: [1, 2, 1],
              opacity: [0.8, 0, 0.8]
            }}
            transition={{
              delay: node.delay + 0.6,
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        </motion.g>
      ))}

      {/* Central processor square - black */}
      <motion.rect
        x="95"
        y="95"
        width="10"
        height="10"
        fill="#000000"
        stroke="#DA291C"
        strokeWidth="2"
        initial={{ scale: 0, rotate: 0 }}
        animate={{ scale: 1, rotate: 90 }}
        transition={{ delay: 2, duration: 0.8, type: "spring" }}
      />

      {/* Data flow arrows */}
      <motion.path
        d="M 47 100 L 50 97 M 47 100 L 50 103"
        stroke="#DA291C"
        strokeWidth="2"
        strokeLinecap="square"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.2 }}
      />

      <motion.path
        d="M 153 90 L 150 87 M 153 90 L 150 93"
        stroke="#FFCD00"
        strokeWidth="2"
        strokeLinecap="square"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.3 }}
      />
    </svg>
  );
}
