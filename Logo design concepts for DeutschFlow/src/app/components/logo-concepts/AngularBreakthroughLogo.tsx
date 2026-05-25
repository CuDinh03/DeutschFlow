import { motion } from "motion/react";

export function AngularBreakthroughLogo({ className = "", size = 120 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={className}
      fill="none"
    >
      <defs>
        <linearGradient id="angularGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#000000', stopOpacity: 1 }} />
          <stop offset="50%" style={{ stopColor: '#DA291C', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#FFCD00', stopOpacity: 1 }} />
        </linearGradient>

        {/* Sharp angle pattern for precision */}
        <pattern id="angularPattern" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="15" x2="30" y2="15" stroke="#000000" strokeWidth="1" opacity="0.1" />
        </pattern>
      </defs>

      {/* Angular pattern background */}
      <motion.rect
        x="50"
        y="50"
        width="100"
        height="100"
        fill="url(#angularPattern)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      />

      {/* Main sharp angular D */}
      <motion.path
        d="M 65 65 L 65 135 L 95 135 L 125 115 L 135 100 L 125 85 L 95 65 Z"
        fill="none"
        stroke="#000000"
        strokeWidth="6"
        strokeLinejoin="miter"
        strokeLinecap="square"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.5, ease: "easeInOut" }}
      />

      {/* Breakthrough triangular shards - red */}
      <motion.polygon
        points="135,100 155,90 145,105"
        fill="#DA291C"
        stroke="#000000"
        strokeWidth="2"
        strokeLinejoin="miter"
        initial={{ x: -30, opacity: 0, rotate: -45 }}
        animate={{ x: 0, opacity: 1, rotate: 0 }}
        transition={{ delay: 1.2, type: "spring", stiffness: 150 }}
      />

      <motion.polygon
        points="135,100 150,115 140,105"
        fill="#DA291C"
        stroke="#000000"
        strokeWidth="2"
        strokeLinejoin="miter"
        initial={{ x: -30, opacity: 0, rotate: 45 }}
        animate={{ x: 0, opacity: 1, rotate: 0 }}
        transition={{ delay: 1.4, type: "spring", stiffness: 150 }}
      />

      {/* Yellow precision triangles */}
      <motion.polygon
        points="125,85 135,75 140,85"
        fill="#FFCD00"
        stroke="#000000"
        strokeWidth="2"
        strokeLinejoin="miter"
        initial={{ scale: 0, rotate: 180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ delay: 1.6, type: "spring", stiffness: 200 }}
      />

      <motion.polygon
        points="125,115 135,125 140,115"
        fill="#FFCD00"
        stroke="#000000"
        strokeWidth="2"
        strokeLinejoin="miter"
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ delay: 1.8, type: "spring", stiffness: 200 }}
      />

      {/* Sharp corner nodes - system logic points */}
      {[
        { x: 65, y: 65 },
        { x: 65, y: 135 },
        { x: 95, y: 65 },
        { x: 95, y: 135 },
        { x: 135, y: 100 }
      ].map((pos, i) => (
        <motion.rect
          key={i}
          x={pos.x - 3}
          y={pos.y - 3}
          width="6"
          height="6"
          fill="#000000"
          stroke="#FFCD00"
          strokeWidth="1"
          initial={{ scale: 0, rotate: 45 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 2 + i * 0.1, type: "spring", stiffness: 300 }}
        />
      ))}

      {/* Angular breakthrough rays */}
      {[0, 1, 2].map((i) => (
        <motion.line
          key={i}
          x1="135"
          y1="100"
          x2={155 + i * 5}
          y2={95 - i * 8}
          stroke="#FFCD00"
          strokeWidth="2"
          strokeLinecap="square"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.7 }}
          transition={{ delay: 2.5 + i * 0.1, duration: 0.4 }}
        />
      ))}

      {/* System precision frame - sharp corners */}
      <motion.path
        d="M 50 50 L 80 50 M 150 50 L 150 50 M 150 80 L 150 50 L 120 50 M 50 120 L 50 150 L 80 150 M 120 150 L 150 150 L 150 120"
        stroke="#DA291C"
        strokeWidth="3"
        strokeLinecap="square"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 2.8, duration: 1.2 }}
      />

      {/* German engineering label */}
      <motion.text
        x="100"
        y="175"
        textAnchor="middle"
        fontSize="7"
        fontFamily="monospace"
        fontWeight="bold"
        fill="#000000"
        letterSpacing="2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.7 }}
        transition={{ delay: 3 }}
      >
        DURCHBRUCH
      </motion.text>
    </svg>
  );
}
