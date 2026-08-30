import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// An inline text link. Default is underlined in the running text; `quiet` is
// for secondary links in meta rows (muted, foreground on hover); `accent`
// for the one link that is the point of the sentence. Pass `render` with a
// router Link for in-app navigation.
const linkVariants = cva(
  "rounded-[3px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
  {
    variants: {
      variant: {
        default:
          "text-foreground underline decoration-foreground/30 underline-offset-[3px] hover:decoration-foreground",
        quiet: "text-muted-foreground hover:text-foreground",
        accent: "text-link hover:underline hover:underline-offset-[3px]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export const TextLink = ({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"a"> & VariantProps<typeof linkVariants>) =>
  useRender({
    defaultTagName: "a",
    props: mergeProps<"a">(
      { className: cn(linkVariants({ variant }), className) },
      props,
    ),
    render,
    state: { slot: "link" },
  });
