import React from "react";

import { type Demo } from "./demo";
import { EditableText } from "./editable-text";

const Example = () => {
  const [title, setTitle] = React.useState("Two Ways To Do Dynamic Dispatch");
  const [url, setUrl] = React.useState(
    "https://www.youtube.com/watch?v=x1npPrzyKfs",
  );
  const [note, setNote] = React.useState("");
  return (
    <div className="flex max-w-md flex-col gap-3">
      <EditableText
        value={title}
        onChange={setTitle}
        placeholder="Untitled"
        aria-label="Title"
        className="font-content text-heading font-semibold tracking-tight"
      />
      <EditableText
        value={url}
        onChange={setUrl}
        placeholder="https://"
        aria-label="URL"
        className="text-small text-muted-foreground"
      />
      <EditableText
        value={note}
        onChange={setNote}
        placeholder="Add a short note"
        aria-label="Note"
        multiline
        className="text-body"
      />
      <p className="pt-2 text-small text-muted-foreground">
        Click any line to edit it. Enter commits, Escape reverts; the note
        accepts new lines and commits on ⌘Enter.
      </p>
    </div>
  );
};

export const demo: Demo = {
  title: "Editable text",
  description:
    "Text that edits in place: it keeps the type style it sits in and shows no chrome at all, only the text cursor. Titles, URLs, row labels.",
  render: () => <Example />,
};
