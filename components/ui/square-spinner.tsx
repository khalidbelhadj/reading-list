import { cn } from "@/lib/utils";

// Four corner dots, pulsing clockwise in a staggered loop. Animation keyframes
// (`spinner-dot-pulse`) live in app/globals.css. The order array maps grid
// positions (TL, TR, BL, BR) to delay steps so the pulse travels clockwise.
const PULSE_ORDER = [0, 1, 3, 2];

export const SquareSpinner = ({ className }: { className?: string }) => (
  <span
    role="status"
    aria-label="Loading"
    className={cn("grid size-3.5 grid-cols-2 gap-0.5", className)}
  >
    {PULSE_ORDER.map((step, index) => (
      <span
        key={index}
        className="size-1.5 rounded-[2px] bg-primary"
        style={{
          animation: "spinner-dot-pulse 1.2s ease-in-out infinite",
          animationDelay: `${step * 0.15}s`,
        }}
      />
    ))}
  </span>
);
