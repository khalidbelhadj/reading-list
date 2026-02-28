"use client";

import React from "react";

const FONTS = [
  { label: "Inter", value: '"Inter Variable", sans-serif' },
  { label: "Lora", value: '"Lora Variable", serif' },
  { label: "Crimson Pro", value: '"Crimson Pro Variable", serif' },
  { label: "Source Serif 4", value: '"Source Serif 4 Variable", serif' },
];

export function FontPicker() {
  const [debug, setDebug] = React.useState(false);

  React.useEffect(() => {
    setDebug(new URLSearchParams(window.location.search).get("debug") === "true");
  }, []);

  const [uiFont, setUiFont] = React.useState(
    () => FONTS.find((f) => f.label === "Source Serif 4")?.value ?? FONTS[0].value,
  );
  const [itemFont, setItemFont] = React.useState(
    () => FONTS.find((f) => f.label === "Source Serif 4")?.value ?? FONTS[0].value,
  );

  function pickUi(value: string) {
    setUiFont(value);
    document.body.style.fontFamily = value;
  }

  function pickItem(value: string) {
    setItemFont(value);
    document.querySelectorAll<HTMLElement>("[data-item-title]").forEach((el) => {
      el.style.fontFamily = value;
    });
    // Store on body so new items rendered later pick it up via the CSS variable
    document.body.style.setProperty("--font-item", value);
  }

  if (!debug) return null;

  return (
    <div className="fixed left-4 top-4 z-50 flex gap-4 rounded-lg border bg-background/90 backdrop-blur-sm p-3 shadow-sm">
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">
          UI
        </span>
        {FONTS.map((font) => (
          <button
            key={font.label}
            type="button"
            onClick={() => pickUi(font.value)}
            className={`text-left text-xs px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
              uiFont === font.value
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
            style={{ fontFamily: font.value }}
          >
            {font.label}
          </button>
        ))}
      </div>
      <div className="w-px bg-border" />
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">
          Items
        </span>
        {FONTS.map((font) => (
          <button
            key={font.label}
            type="button"
            onClick={() => pickItem(font.value)}
            className={`text-left text-xs px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
              itemFont === font.value
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
            style={{ fontFamily: font.value }}
          >
            {font.label}
          </button>
        ))}
      </div>
    </div>
  );
}
