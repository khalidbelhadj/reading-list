import { IconChevronRight } from "@tabler/icons-react";

import { type Demo } from "./demo";
import { TextLink } from "./link";

export const demo: Demo = {
  title: "Link",
  description:
    "Inline text links. Underlined in running text, quiet in meta rows, accent when the link is the point.",
  render: () => (
    <div className="flex max-w-md flex-col gap-4">
      <p className="text-body">
        Besides method pointers, a vtable stores the size and alignment of the
        concrete type, as <TextLink href="#">the Rust reference</TextLink>{" "}
        explains.
      </p>
      <div className="flex items-center gap-4 text-small">
        <TextLink
          href="#"
          variant="quiet"
          className="flex items-center gap-0.5"
        >
          All 198
          <IconChevronRight className="size-3" />
        </TextLink>
        <TextLink href="#" variant="quiet">
          Open item
        </TextLink>
        <TextLink href="#" variant="accent">
          Start review
        </TextLink>
      </div>
    </div>
  ),
};
