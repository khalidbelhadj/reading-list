import React from "react";

import { type Demo } from "@/components/system/demo";
import { MarkdownEditor } from "@/components/system/markdown-editor";

import { flashcardExtensions } from "./flashcard-node";

const SAMPLE = `Some notes above the card.

<card id="demo1234">
<front>
What does the MESI protocol's **E (Exclusive)** state guarantee?
</front>
<back>
The line is present only in this cache and matches memory, so it can be written without a bus transaction.
</back>
</card>

And notes continue after it. Insert a new card with Cmd+Shift+C; Tab hops between front and back.`;

const EditorWithCard = () => {
  const [value, setValue] = React.useState(SAMPLE);
  return (
    <MarkdownEditor
      value={value}
      onChange={setValue}
      extensions={flashcardExtensions}
    />
  );
};

export const demo: Demo = {
  title: "Flashcard node",
  description:
    "The <card> block inside the markdown editor, styled as the Sheet card. Parsing is fence-aware (a </card> inside a code block is content) and ids are sanitized before they round-trip.",
  render: () => (
    <div className="w-120">
      <EditorWithCard />
    </div>
  ),
};
