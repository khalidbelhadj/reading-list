import React from "react";

import { MarkdownEditor } from "@/components/editor/markdown-editor";

const SEED = `Click the language picker at the top-right of the code block below.

\`\`\`typescript
const greeting = "hello";
console.log(greeting);
\`\`\`

Text after the code block.`;

const CodeBlockPlayground = () => {
  const [value, setValue] = React.useState(SEED);

  return (
    <div className="min-h-dvh px-5 py-10">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-content text-xl">Code block language picker</h1>
          <p className="text-sm text-muted-foreground">
            Repro for the picker dropdown not opening. Click the chip at the
            code block&apos;s top-right.
          </p>
        </div>

        <div className="rounded-lg bg-card p-4">
          <MarkdownEditor
            value={value}
            onChange={setValue}
            placeholder="Notes…"
          />
        </div>
      </div>
    </div>
  );
};

const CodeBlockPage = () => {
  return <CodeBlockPlayground />;
};

export default CodeBlockPage;
