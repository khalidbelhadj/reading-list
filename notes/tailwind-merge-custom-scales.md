# tailwind-merge silently drops custom scale utilities

**Symptom.** Sidebar rows rendered at 16px while the editor was 13px, even
though `ListRow` has `text-body` in its class string. The board's badges and
a few other kit pieces were quietly oversized the same way.

**Cause.** `cn()` runs `twMerge`, and tailwind-merge only knows Tailwind's
default scales. Our design-system utilities (`text-body`, `text-small`,
`text-micro`, `text-title`, `rounded-control`, `shadow-surface`, `h-row`, …)
are unknown to it, so it guesses their group from the prefix: `text-body`
was filed as a *text colour*. Any later colour class (`text-foreground`,
`text-muted-foreground`) then "conflicted" with it and tailwind-merge
removed `text-body` from the output. The source looked right; the DOM
never had the class.

**Fix.** `lib/utils.ts` builds `twMerge` with `extendTailwindMerge`, listing
each custom utility under its real group (`font-size`, `rounded`, `shadow`,
`h`, `min-h`). Any new named scale added to `globals.css` must be added
there too, or it will vanish the first time it meets a sibling class.

**What generalises.** When a Tailwind class is "in the source but not in the
element", suspect tailwind-merge before the CSS build. Check with
`element.className` in the console: if the class is absent there, the merge
ate it.
