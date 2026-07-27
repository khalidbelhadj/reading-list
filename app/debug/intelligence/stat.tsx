// A labelled count for the page's top bar, rendered as one compound tag:
// value then label inside a single badge, so a row of these reads as discrete
// pills rather than number-plus-loose-text. Tones match the table's badge
// variants, so "running" here is the same colour as "running" in a Queue cell.
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
  <Badge variant={tone} className="gap-1">
    <span className="tabular-nums">{value}</span>
    <span className="font-normal opacity-70">{label}</span>
  </Badge>
);
