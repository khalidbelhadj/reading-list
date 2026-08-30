import { IconArrowRight, IconPlus, IconTrash } from "@tabler/icons-react";

import { Button } from "./button";
import { type Demo } from "./demo";

const Row = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex items-center gap-3">
    <span className="w-24 shrink-0 text-small text-muted-foreground">
      {label}
    </span>
    <div className="flex flex-wrap items-center gap-2">{children}</div>
  </div>
);

export const demo: Demo = {
  title: "Button",
  description:
    "Primary carries the accent and appears once per view. Secondary and ghost are the quiet tiers; destructive is for delete confirmations only.",
  render: () => (
    <div className="flex flex-col gap-4">
      <Row label="Variants">
        <Button variant="primary">Review 110</Button>
        <Button variant="secondary">Flip</Button>
        <Button variant="ghost">Next</Button>
        <Button variant="destructive">Delete</Button>
      </Row>
      <Row label="Sizes">
        <Button size="sm" variant="primary">
          Small
        </Button>
        <Button size="md" variant="primary">
          Medium
        </Button>
        <Button size="lg" variant="primary">
          Large
        </Button>
      </Row>
      <Row label="With icon">
        <Button variant="primary">
          <IconPlus />
          Add
        </Button>
        <Button variant="secondary">
          Open
          <IconArrowRight />
        </Button>
        <Button variant="ghost">
          <IconTrash />
          Remove
        </Button>
      </Row>
      <Row label="Icon only">
        <Button size="icon-sm" variant="ghost" aria-label="Add">
          <IconPlus />
        </Button>
        <Button size="icon-md" variant="secondary" aria-label="Add">
          <IconPlus />
        </Button>
        <Button size="icon-lg" variant="primary" aria-label="Add">
          <IconPlus />
        </Button>
      </Row>
      <Row label="Disabled">
        <Button variant="primary" disabled>
          Review
        </Button>
        <Button variant="secondary" disabled>
          Flip
        </Button>
        <Button variant="ghost" disabled>
          Next
        </Button>
      </Row>
    </div>
  ),
};
