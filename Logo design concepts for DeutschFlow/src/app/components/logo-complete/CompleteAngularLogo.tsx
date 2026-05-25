import { motion } from "motion/react";

type LogoVariant = 'horizontal' | 'vertical' | 'icon-only';

interface CompleteAngularLogoProps {
  variant?: LogoVariant;
  size?: number;
  className?: string;
  animated?: boolean;
}

export function CompleteAngularLogo({
  variant = 'horizontal',
  size = 200,
  className = "",
  animated = true
}: CompleteAngularLogoProps) {

  if (variant === 'icon-only') {
    return (
      <svg
        width={size * 0.4}
        height={size * 0.4}
        viewBox="0 0 100 100"
        className={className}
        fill="none"
      >
        <motion.path
          d="M 20 20 L 20 80 L 40 80 L 60 65 L 70 50 L 60 35 L 40 20 Z"
          fill="none"
          stroke="#000000"
          strokeWidth="5"
          strokeLinejoin="miter"
          initial={animated ? { pathLength: 0 } : { pathLength: 1 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1 }}
        />
        <motion.polygon
          points="70,50 85,45 78,53"
          fill="#DA291C"
          stroke="#000000"
          strokeWidth="2"
          strokeLinejoin="miter"
          initial={animated ? { x: -20, opacity: 0 } : { x: 0, opacity: 1 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.8, type: "spring" }}
        />
        <motion.polygon
          points="60,35 70,28 72,35"
          fill="#FFCD00"
          stroke="#000000"
          strokeWidth="2"
          initial={animated ? { scale: 0 } : { scale: 1 }}
          animate={{ scale: 1 }}
          transition={{ delay: 1, type: "spring" }}
        />
      </svg>
    );
  }

  if (variant === 'vertical') {
    return (
      <svg
        width={size * 0.5}
        height={size}
        viewBox="0 0 120 240"
        className={className}
        fill="none"
      >
        <g transform="translate(15, 20)">
          <motion.path
            d="M 15 15 L 15 75 L 35 75 L 55 60 L 65 45 L 55 30 L 35 15 Z"
            fill="none"
            stroke="#000000"
            strokeWidth="5"
            strokeLinejoin="miter"
            initial={animated ? { pathLength: 0 } : { pathLength: 1 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1 }}
          />
          <motion.polygon
            points="65,45 80,40 73,48"
            fill="#DA291C"
            stroke="#000000"
            strokeWidth="2"
            initial={animated ? { x: -20, opacity: 0 } : { x: 0, opacity: 1 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.8 }}
          />
          <motion.polygon
            points="55,30 65,23 67,30"
            fill="#FFCD00"
            stroke="#000000"
            strokeWidth="2"
            initial={animated ? { scale: 0 } : { scale: 1 }}
            animate={{ scale: 1 }}
            transition={{ delay: 1 }}
          />
        </g>

        <motion.text x="60" y="140" textAnchor="middle" fontFamily="system-ui" fontWeight="700" fontSize="14" fill="#000000"
          initial={animated ? { opacity: 0 } : { opacity: 1 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
        >my</motion.text>
        <motion.text x="60" y="162" textAnchor="middle" fontFamily="system-ui" fontWeight="700" fontSize="20" fill="#000000"
          initial={animated ? { opacity: 0 } : { opacity: 1 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.3 }}
        >Deutsch</motion.text>
        <motion.text x="60" y="182" textAnchor="middle" fontFamily="system-ui" fontWeight="700" fontSize="20" fill="#DA291C"
          initial={animated ? { opacity: 0 } : { opacity: 1 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
        >Flow</motion.text>
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size * 0.4}
      viewBox="0 0 400 100"
      className={className}
      fill="none"
    >
      <g transform="translate(10, 10)">
        <motion.path
          d="M 15 15 L 15 70 L 35 70 L 50 58 L 58 43 L 50 28 L 35 15 Z"
          fill="none"
          stroke="#000000"
          strokeWidth="5"
          strokeLinejoin="miter"
          strokeLinecap="square"
          initial={animated ? { pathLength: 0 } : { pathLength: 1 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1 }}
        />
        <motion.polygon
          points="58,43 70,39 65,46"
          fill="#DA291C"
          stroke="#000000"
          strokeWidth="2"
          strokeLinejoin="miter"
          initial={animated ? { x: -15, opacity: 0 } : { x: 0, opacity: 1 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.8, type: "spring" }}
        />
        <motion.polygon
          points="50,28 58,22 60,28"
          fill="#FFCD00"
          stroke="#000000"
          strokeWidth="2"
          strokeLinejoin="miter"
          initial={animated ? { scale: 0 } : { scale: 1 }}
          animate={{ scale: 1 }}
          transition={{ delay: 1, type: "spring" }}
        />
      </g>

      <g transform="translate(95, 0)">
        <motion.text x="0" y="32" fontFamily="system-ui" fontWeight="300" fontSize="16" fill="#000000" letterSpacing="1"
          initial={animated ? { opacity: 0, x: -20 } : { opacity: 1, x: 0 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.2 }}
        >my</motion.text>
        <motion.text x="28" y="32" fontFamily="system-ui" fontWeight="700" fontSize="24" fill="#000000" letterSpacing="-0.5"
          initial={animated ? { opacity: 0, x: -20 } : { opacity: 1, x: 0 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.3 }}
        >Deutsch</motion.text>
        <motion.text x="130" y="32" fontFamily="system-ui" fontWeight="700" fontSize="24" fill="#DA291C" letterSpacing="-0.5"
          initial={animated ? { opacity: 0, x: -20 } : { opacity: 1, x: 0 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.4 }}
        >Flow</motion.text>
        <motion.text x="0" y="52" fontFamily="system-ui" fontWeight="400" fontSize="9" fill="#666666" letterSpacing="2"
          initial={animated ? { opacity: 0 } : { opacity: 1 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6 }}
        >BREAKTHROUGH LEARNING EXPERIENCE</motion.text>
      </g>
    </svg>
  );
}
