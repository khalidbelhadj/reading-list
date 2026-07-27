// A labelled count for the page's top bar. The number carries the badge so it
// reads as a value at a glance; the label stays plain text so a row of these
// doesn't turn into a wall of pills. Tones match the table's badge variants,
// so "running" in the header is the same colour as "running" in a Queue cell.
import { Badge } from "@/components/ui/badge";

export const Stat = ({
  label,
  value,
  tone = "secondary",
}: {
  label: string;
  value: React.ReactNode;
  tone?: React.ComponentProps<typeof Badge>["variant"];
}) => (
  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
    <Badge variant={tone} className="tabular-nums">
      {value}
    </Badge>
    {label}
  </span>
);
