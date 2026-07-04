"use client";

import React from "react";
import { notFound } from "next/navigation";

import { MarkdownEditor } from "@/components/ui/markdown-editor";

const SEED = `Inline $e^{i\\pi}+1=0$ stays inline.

Display math (click to edit):

$$
\\int_{0}^{\\infty} e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}
$$

Type \`$$\` on a blank line to make a new one.`;

const MathPlayground = () => {
  const [value, setValue] = React.useState(SEED);

  return (
    <div className="min-h-dvh px-5 py-10">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-content text-xl">Math live preview</h1>
          <p className="text-sm text-muted-foreground">
            Block math (`$$…$$`) opens an editable, syntax-highlighted LaTeX
            source with a live preview beneath. The panel below shows the stored
            markdown so you can check the round-trip.
          </p>
        </div>
        <div className="rounded-lg bg-card p-4">
          <MarkdownEditor value={value} onChange={setValue} placeholder="…" />
        </div>
        <pre className="overflow-auto rounded-lg bg-card p-4 text-xs whitespace-pre-wrap">
          {value}
        </pre>
      </div>
    </div>
  );
};

const MathPage = () => {
  if (process.env.NODE_ENV !== "development") notFound();
  return <MathPlayground />;
};

export default MathPage;
