import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const kbdVariants = cva(
  "pointer-events-none inline-flex w-fit items-center justify-center gap-1 rounded-xs font-sans font-medium select-none",
  {
    variants: {
      variant: {
        default:
          "bg-muted text-muted-foreground in-data-[slot=tooltip-content]:bg-background/20 in-data-[slot=tooltip-content]:text-background dark:in-data-[slot=tooltip-content]:bg-background/10",
        primary: "bg-primary-foreground/15 text-primary-foreground/90",
        destructive:
          "bg-destructive/20 text-destructive dark:bg-destructive/30",
      },
      size: {
        xs: "h-4 min-w-4 px-1 text-[0.5625rem] [&_svg:not([class*='size-'])]:size-2.5",
        sm: "h-5 min-w-5 px-1 text-[0.625rem] [&_svg:not([class*='size-'])]:size-3",
        md: "h-6 min-w-6 px-1.5 text-xs [&_svg:not([class*='size-'])]:size-3",
        lg: "h-7 min-w-7 px-2 text-sm [&_svg:not([class*='size-'])]:size-3.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "sm",
    },
  },
);

const Kbd = ({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<"kbd"> & VariantProps<typeof kbdVariants>) => {
  return (
    <kbd
      data-slot="kbd"
      className={cn(kbdVariants({ variant, size, className }))}
      {...props}
    />
  );
};

const KbdGroup = ({ className, ...props }: React.ComponentProps<"div">) => {
  return (
    <kbd
      data-slot="kbd-group"
      className={cn("inline-flex items-center gap-1", className)}
      {...props}
    />
  );
};

export { Kbd, KbdGroup, kbdVariants };
