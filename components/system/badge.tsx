import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Small status label: Due, New, a tag. Neutral by default; accent only for
// the one state that matters right now (a due card); outline for tags.
const badgeVariants = cva(
  "inline-flex h-5 w-fit shrink-0 items-center gap-1 rounded-[calc(var(--r-control)-4px)] px-1.5 text-micro font-medium whitespace-nowrap select-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        neutral: "bg-foreground/[0.07] text-foreground/80",
        accent: "bg-primary/20 text-primary dark:bg-primary/25",
        outline: "text-muted-foreground ring-1 ring-border ring-inset",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export const Badge = ({
  className,
  variant = "neutral",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) =>
  useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      { className: cn(badgeVariants({ variant }), className) },
      props,
    ),
    render,
    state: { slot: "badge" },
  });
