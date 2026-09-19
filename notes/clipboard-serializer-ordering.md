# Copy from the notes editor leaked `&nbsp;` and code-fence markers

## Symptom

Copying text out of the markdown editor (`components/system/markdown-editor.tsx`):

- Selecting a section of a code block and copying pasted the ```` ``` ```` fences
  along with the code.
- Copies that spanned an intentional blank line pasted a literal `&nbsp;` /
  non-breaking space where the blank line was.

## Cause

Two independent things, one shared root cause.

1. **Blank-line sentinel generations.** Empty paragraphs are stored as a
   `&nbsp;` line (`BLANK_LINE_SENTINEL`, `lib/markdown.ts`) so blank lines
   survive the markdown round-trip. But markdown-it *decodes* `&nbsp;` to a real
   U+00A0 on load, and re-serializing that paragraph emits the raw U+00A0
   character, not the entity. `stripBlankLineSentinel` only matched the literal
   string `&nbsp;`, so every generation after the first (a U+00A0 line) slipped
   through. Fix: match a line that is *either* `&nbsp;` or a lone U+00A0.

2. **The wrong clipboard serializer was winning.** `CleanClipboardMarkdown`
   (`components/system/markdown-editor/extensions.ts`) registers a
   `clipboardTextSerializer` that serializes to markdown, copies code selections
   as raw text, and strips the sentinel. But **tiptap-markdown also registers
   one** (its `transformCopiedText` option, plugin key `markdownClipboard$`).
   ProseMirror's `someProp("clipboardTextSerializer", f => f(slice, view))`
   returns the first plugin whose serializer returns a non-null value, in
   plugin-array order — and tiptap-markdown's landed first, so ours never ran on
   copy. Extension `priority` did **not** reliably reorder it. The old comment
   claiming "higher priority than the Markdown extension so this wins" was
   wrong; it had likely never actually won.

   Fix: set `transformCopiedText: false` on `Markdown.configure(...)`. That
   plugin then returns `null`, ProseMirror falls through to ours, and ours does
   markdown + raw-code + sentinel-strip.

## Debugging note (dev only)

This was slow to pin down because the tiptap `Editor` is created once and its
ProseMirror plugins capture the module bindings from *that* moment. Vite HMR
swaps the modules underneath but does not rebuild the editor, so a running dev
editor keeps executing the *old* plugin closure even though `curl`-ing the
module and `await import()`-ing it both show the new code. Verify serializer
changes in a **freshly loaded tab**, and check the real path with the callback
form: `view.someProp("clipboardTextSerializer", f => f(slice, view))` — the
no-callback form just returns the first function, which hides the fall-through.

## Generalises

Any time we add a ProseMirror `props` handler that overlaps one a third-party
tiptap extension already provides (clipboard, paste, key handling), remember
that `someProp` is first-non-null-wins in plugin order, not priority order.
Turn the other one off rather than trying to out-prioritise it.
