import { motion } from "motion/react";

type LogoVariant = 'horizontal' | 'vertical' | 'icon-only';

interface CompleteCircuitLogoProps {
  variant?: LogoVariant;
  size?: number;
  className?: string;
  animated?: boolean;
}

export function CompleteCircuitLogo({
  variant = 'horizontal',
  size = 200,
  className = "",
  animated = true
}: CompleteCircuitLogoProps) {

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
          d="M 25 25 L 25 75 L 50 75 C 65 75 75 65 75 50 C 75 35 65 25 50 25 Z"
          fill="none"
          stroke="#000000"
          strokeWidth="4"
          initial={animated ? { pathLength: 0 } : { pathLength: 1 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.2 }}
        />
        {/* Logic nodes */}
        <motion.circle cx="25" cy="50" r="4" fill="#DA291C" stroke="#000000" strokeWidth="2"
          initial={animated ? { scale: 0 } : { scale: 1 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.8, type: "spring" }}
        />
        <motion.circle cx="75" cy="50" r="4" fill="#FFCD00" stroke="#000000" strokeWidth="2"
          initial={animated ? { scale: 0 } : { scale: 1 }}
          animate={{ scale: 1 }}
          transition={{ delay: 1, type: "spring" }}
        />
        <motion.rect x="47" y="47" width="6" height="6" fill="#000000"
          initial={animated ? { scale: 0, rotate: 0 } : { scale: 1, rotate: 45 }}
          animate={{ scale: 1, rotate: 45 }}
          transition={{ delay: 1.2, type: "spring" }}
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
        <g transform="translate(10, 20)">
          <motion.path
            d="M 25 25 L 25 75 L 50 75 C 65 75 75 65 75 50 C 75 35 65 25 50 25 Z"
            fill="none"
            stroke="#000000"
            strokeWidth="4"
            initial={animated ? { pathLength: 0 } : { pathLength: 1 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.2 }}
          />
          <motion.circle cx="25" cy="50" r="4" fill="#DA291C" stroke="#000000" strokeWidth="2"
            initial={animated ? { scale: 0 } : { scale: 1 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.8, type: "spring" }}
          />
          <motion.circle cx="75" cy="50" r="4" fill="#FFCD00" stroke="#000000" strokeWidth="2"
            initial={animated ? { scale: 0 } : { scale: 1 }}
            animate={{ scale: 1 }}
            transition={{ delay: 1, type: "spring" }}
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
          d="M 15 15 L 15 65 L 40 65 C 55 65 65 55 65 40 C 65 25 55 15 40 15 Z"
          fill="none"
          stroke="#000000"
          strokeWidth="4"
          initial={animated ? { pathLength: 0 } : { pathLength: 1 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.2 }}
        />
        <motion.circle cx="15" cy="40" r="3" fill="#DA291C" stroke="#000000" strokeWidth="1.5"
          initial={animated ? { scale: 0 } : { scale: 1 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.8 }}
        />
        <motion.circle cx="65" cy="40" r="3" fill="#FFCD00" stroke="#000000" strokeWidth="1.5"
          initial={animated ? { scale: 0 } : { scale: 1 }}
          animate={{ scale: 1 }}
          transition={{ delay: 1 }}
        />
        <motion.rect x="37" y="37" width="6" height="6" fill="#000000"
          initial={animated ? { scale: 0, rotate: 0 } : { scale: 1, rotate: 45 }}
          animate={{ scale: 1, rotate: 45 }}
          transition={{ delay: 1.2 }}
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
        >AI-POWERED LANGUAGE PLATFORM</motion.text>
      </g>
    </svg>
  );
}
