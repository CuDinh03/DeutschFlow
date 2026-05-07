import { motion } from "framer-motion";

type LogoVariant = 'horizontal' | 'vertical' | 'icon-only';

interface CompleteBauhausLogoProps {
  variant?: LogoVariant;
  size?: number;
  className?: string;
  animated?: boolean;
}

export function CompleteBauhausLogo({
  variant = 'horizontal',
  size = 200,
  className = "",
  animated = true
}: CompleteBauhausLogoProps) {

  if (variant === 'icon-only') {
    return (
      <svg
        width={size * 0.4}
        height={size * 0.4}
        viewBox="0 0 100 100"
        className={className}
        fill="none"
      >
        {/* Compact icon version */}
        <motion.path
          d="M 20 20 L 20 80 L 50 80 L 70 60 L 70 40 L 50 20 Z"
          fill="none"
          stroke="#000000"
          strokeWidth="6"
          strokeLinejoin="miter"
          initial={animated ? { pathLength: 0 } : { pathLength: 1 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1 }}
        />
        <motion.polygon
          points="50,40 70,50 50,60"
          fill="#DA291C"
          initial={animated ? { scale: 0 } : { scale: 1 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.8, type: "spring" }}
        />
        <motion.rect
          x="24"
          y="46"
          width="8"
          height="8"
          fill="#FFCD00"
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
        {/* Icon part */}
        <g transform="translate(10, 20)">
          <motion.path
            d="M 20 20 L 20 80 L 50 80 L 70 60 L 70 40 L 50 20 Z"
            fill="none"
            stroke="#000000"
            strokeWidth="5"
            strokeLinejoin="miter"
            initial={animated ? { pathLength: 0 } : { pathLength: 1 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1 }}
          />
          <motion.polygon
            points="50,40 70,50 50,60"
            fill="#DA291C"
            initial={animated ? { scale: 0 } : { scale: 1 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.8, type: "spring" }}
          />
          <motion.rect
            x="24"
            y="46"
            width="8"
            height="8"
            fill="#FFCD00"
            initial={animated ? { scale: 0 } : { scale: 1 }}
            animate={{ scale: 1 }}
            transition={{ delay: 1, type: "spring" }}
          />
        </g>

        {/* Text part - vertical stack */}
        <motion.text
          x="60"
          y="140"
          textAnchor="middle"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="700"
          fontSize="14"
          fill="#000000"
          letterSpacing="0.5"
          initial={animated ? { opacity: 0 } : { opacity: 1 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
        >
          my
        </motion.text>
        <motion.text
          x="60"
          y="162"
          textAnchor="middle"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="700"
          fontSize="20"
          fill="#000000"
          letterSpacing="-0.5"
          initial={animated ? { opacity: 0 } : { opacity: 1 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.3 }}
        >
          Deutsch
        </motion.text>
        <motion.text
          x="60"
          y="182"
          textAnchor="middle"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="700"
          fontSize="20"
          fill="#DA291C"
          letterSpacing="-0.5"
          initial={animated ? { opacity: 0 } : { opacity: 1 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
        >
          Flow
        </motion.text>
      </svg>
    );
  }

  // Horizontal variant (default)
  return (
    <svg
      width={size}
      height={size * 0.4}
      viewBox="0 0 400 100"
      className={className}
      fill="none"
    >
      {/* Icon part */}
      <g transform="translate(10, 10)">
        <motion.path
          d="M 10 10 L 10 70 L 40 70 L 60 50 L 60 30 L 40 10 Z"
          fill="none"
          stroke="#000000"
          strokeWidth="5"
          strokeLinejoin="miter"
          initial={animated ? { pathLength: 0 } : { pathLength: 1 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1 }}
        />
        <motion.polygon
          points="40,30 60,40 40,50"
          fill="#DA291C"
          initial={animated ? { scale: 0 } : { scale: 1 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.8, type: "spring" }}
        />
        <motion.rect
          x="14"
          y="36"
          width="6"
          height="6"
          fill="#FFCD00"
          initial={animated ? { scale: 0 } : { scale: 1 }}
          animate={{ scale: 1 }}
          transition={{ delay: 1, type: "spring" }}
        />
      </g>

      {/* Text part - horizontal */}
      <g transform="translate(90, 0)">
        <motion.text
          x="0"
          y="32"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="300"
          fontSize="16"
          fill="#000000"
          letterSpacing="1"
          initial={animated ? { opacity: 0, x: -20 } : { opacity: 1, x: 0 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.2 }}
        >
          my
        </motion.text>
        <motion.text
          x="28"
          y="32"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="700"
          fontSize="24"
          fill="#000000"
          letterSpacing="-0.5"
          initial={animated ? { opacity: 0, x: -20 } : { opacity: 1, x: 0 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.3 }}
        >
          Deutsch
        </motion.text>
        <motion.text
          x="130"
          y="32"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="700"
          fontSize="24"
          fill="#DA291C"
          letterSpacing="-0.5"
          initial={animated ? { opacity: 0, x: -20 } : { opacity: 1, x: 0 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.4 }}
        >
          Flow
        </motion.text>

        {/* Tagline */}
        <motion.text
          x="0"
          y="52"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="400"
          fontSize="9"
          fill="#666666"
          letterSpacing="2"
          initial={animated ? { opacity: 0 } : { opacity: 1 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6 }}
        >
          GERMAN LANGUAGE LEARNING SYSTEM
        </motion.text>
      </g>
    </svg>
  );
}
