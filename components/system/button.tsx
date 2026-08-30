import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// The kit button. One accent (primary), two quiet tiers (secondary, ghost),
// and destructive. Heights follow the tight density: 24 / 28 / 32.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-1.5 rounded-control font-medium whitespace-nowrap outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-depth-button-primary hover:bg-primary/90 data-[pressed]:bg-primary/85",
        secondary:
          "bg-foreground/[0.06] text-foreground hover:bg-foreground/[0.09] aria-expanded:bg-foreground/[0.09] data-[pressed]:bg-foreground/[0.11]",
        ghost:
          "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground aria-expanded:bg-foreground/[0.05] aria-expanded:text-foreground data-[pressed]:bg-foreground/[0.08]",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/30",
      },
      size: {
        sm: "h-6 px-2 text-small [&_svg:not([class*='size-'])]:size-3",
        md: "h-7 px-2.5 text-body [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-8 px-3 text-body [&_svg:not([class*='size-'])]:size-4",
        "icon-sm": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-md": "size-7 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-8 [&_svg:not([class*='size-'])]:size-4",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "md",
    },
  },
);

export const Button = ({
  className,
  variant = "secondary",
  size = "md",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) => (
  <ButtonPrimitive
    data-slot="button"
    className={cn(buttonVariants({ variant, size, className }))}
    {...props}
  />
);
