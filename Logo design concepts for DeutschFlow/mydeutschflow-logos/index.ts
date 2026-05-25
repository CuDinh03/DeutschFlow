/**
 * myDeutschFlow Logo Package
 *
 * Export all logo components for easy importing
 */

export { CompleteBauhausLogo } from './logo-complete/CompleteBauhausLogo';
export { CompleteCircuitLogo } from './logo-complete/CompleteCircuitLogo';
export { CompleteAngularLogo } from './logo-complete/CompleteAngularLogo';

// Type exports
export type LogoVariant = 'horizontal' | 'vertical' | 'icon-only';

export interface LogoProps {
  variant?: LogoVariant;
  size?: number;
  className?: string;
  animated?: boolean;
}
