import { IconStarFilled } from "@tabler/icons-react";
import React from "react";

import { type Demo } from "@/components/system/demo";

import { Favicon } from "./favicon";
import { ItemMenu } from "./item-menu";
import { ListRow } from "./list-row";

const Row = () => {
  const [read, setRead] = React.useState(false);
  const [starred, setStarred] = React.useState(true);
  const [hidden, setHidden] = React.useState(false);
  const [deleted, setDeleted] = React.useState(false);

  if (deleted) {
    return (
      <p className="px-2 text-small text-muted-foreground">
        Deleted. Refresh the demo to bring it back.
      </p>
    );
  }
  return (
    <ItemMenu
      item={{
        read,
        starred,
        hiddenFromReview: hidden,
        url: "https://example.com",
        flashcardCount: 3,
      }}
      onToggleRead={() => setRead((prev) => !prev)}
      onToggleStar={() => setStarred((prev) => !prev)}
      onToggleHidden={() => setHidden((prev) => !prev)}
      onChatWithClaude={() => {}}
      onDelete={() => setDeleted(true)}
      onOpenLink={() => {}}
      onCopyLink={() => {}}
    >
      <ListRow
        leading={<Favicon item={{ url: "https://example.com" }} />}
        title="Right-click this row"
        muted={read}
        trailing={
          starred ? (
            <IconStarFilled className="size-3 shrink-0 text-starred" />
          ) : undefined
        }
      />
    </ItemMenu>
  );
};

export const demo: Demo = {
  title: "Item menu",
  description:
    "The right-click menu for an item row: read state, star, delete. Presentation only; callers own the mutations. The starred marker uses the --starred gold.",
  render: () => (
    <div className="w-72">
      <Row />
    </div>
  ),
};
