import React from "react";

import { type Demo } from "./demo";
import { MarkdownEditor } from "./markdown-editor";
import { Surface } from "./surface";

const SAMPLE = `# Dynamic dispatch

Two ways to do it, compared in **Logan Smith's** video:

- An embedded vtable pointer, the C++ way
- A fat pointer, the Rust way (\`&dyn Trait\`)

Still to do:

- [x] Watch the video
- [ ] Write the card

> The trade-off is memory layout against call-site cost.

\`\`\`rust
fn call(x: &dyn Shape) -> f64 {
    x.area()
}
\`\`\`

Vtable size is $O(n)$ in methods; see the [reference](https://doc.rust-lang.org/reference/).

$$
\\text{size} = \\sum_{i=1}^{n} 8
$$
`;

const Example = () => {
  const [value, setValue] = React.useState(SAMPLE);
  const [note, setNote] = React.useState("");
  return (
    <div className="flex flex-col gap-8">
      <Surface>
        <MarkdownEditor
          value={value}
          onChange={setValue}
          toolbar
          placeholder="Write"
        />
      </Surface>
      <div className="flex flex-col gap-2">
        <p className="text-small text-muted-foreground">
          Bare, no toolbar: select text for the bubble.
        </p>
        <MarkdownEditor value={note} onChange={setNote} placeholder="Notes" />
      </div>
      <details className="text-small text-muted-foreground">
        <summary className="cursor-default select-none">Markdown out</summary>
        <pre className="mt-2 overflow-x-auto rounded-control bg-foreground/[0.04] p-3 font-mono text-micro whitespace-pre-wrap text-foreground">
          {value}
        </pre>
      </details>
    </div>
  );
};

export const demo: Demo = {
  title: "Markdown editor",
  description:
    "Markdown in, markdown out. Headings, lists, checklists, quotes, code blocks with a language picker, inline and block math, links with a click popover, a formatting bubble over any selection, and an optional toolbar. App nodes plug in through `extensions`.",
  render: () => <Example />,
};
