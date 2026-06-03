/**
 * Spinner — small inline loader for buttons and async UI.
 *
 * Inherits color via `currentColor`, so it looks correct on primary,
 * outline, and ghost buttons alike. Drives off the shared
 * `@keyframes spin` declared in `src/styles/nova-design.css`, so no extra
 * CSS is required at the consumer site.
 */

interface SpinnerProps {
  size?: number;
  thickness?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function Spinner({ size = 14, thickness = 2, className, style }: SpinnerProps) {
  return (
    <span
      aria-hidden
      className={className}
      style={{
        display: "inline-block",
        width: size,
        height: size,
        border: `${thickness}px solid currentColor`,
        borderTopColor: "transparent",
        borderRadius: "50%",
        animation: "spin 0.6s linear infinite",
        flexShrink: 0,
        ...style,
      }}
    />
  );
}
