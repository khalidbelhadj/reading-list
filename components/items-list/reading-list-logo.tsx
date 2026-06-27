import { cn } from "@/lib/utils";

export const ReadingListLogo = ({ className }: { className?: string }) => (
  <span
    aria-hidden="true"
    className={cn(
      "relative inline-flex size-3.5 shrink-0 items-center justify-center rounded-[4px] bg-primary shadow-depth-button-primary",
      className,
    )}
  >
    <svg viewBox="0 0 24 24" className="size-2.5">
      <g transform="translate(3 3) scale(0.75)">
        <path
          className="fill-primary-foreground"
          d="M14 2a5 5 0 0 1 5 5v14a1 1 0 0 1 -1.555 .832l-5.445 -3.63l-5.444 3.63a1 1 0 0 1 -1.55 -.72l-.006 -.112v-14a5 5 0 0 1 5 -5h4z"
        />
      </g>
    </svg>
  </span>
);
