import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import React from "react";

import { cn } from "@/lib/utils";

const MAX_AUTO_MARKS = 24;

// A single value on a range: zoom, font size. A thick track with the accent
// fill and a round thumb the height of the track. `marks` draws a dot on
// each step (or on the values given) so a stepped slider shows where it can
// land; labels and values live outside, in a Field.
export const Slider = ({
  className,
  marks,
  min = 0,
  max = 100,
  step = 1,
  ...props
}: SliderPrimitive.Root.Props & { marks?: boolean | number[] }) => {
  const markValues = React.useMemo(() => {
    if (!marks) return [];
    if (Array.isArray(marks)) return marks;
    const count = Math.floor((max - min) / step);
    if (count > MAX_AUTO_MARKS) return [];
    return Array.from({ length: count + 1 }, (_, index) => min + index * step);
  }, [marks, min, max, step]);

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn("w-full", className)}
      min={min}
      max={max}
      step={step}
      thumbAlignment="edge"
      {...props}
    >
      <SliderPrimitive.Control className="relative flex h-5 w-full touch-none items-center select-none data-disabled:opacity-50">
        <SliderPrimitive.Track className="relative h-5 grow overflow-hidden rounded-full bg-foreground/[0.1]">
          <SliderPrimitive.Indicator className="h-full bg-primary" />
          {markValues.length > 0 && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-2.5 inset-y-0"
            >
              {markValues.map((value) => (
                <span
                  key={value}
                  className="absolute top-1/2 size-1 -translate-1/2 rounded-full bg-background/70"
                  style={{ left: `${((value - min) / (max - min)) * 100}%` }}
                />
              ))}
            </div>
          )}
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="block size-5 rounded-full bg-surface shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_1px_3px_rgb(0_0_0/0.25)] outline-none focus-visible:ring-2 focus-visible:ring-ring/40 dark:bg-foreground" />
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
};
