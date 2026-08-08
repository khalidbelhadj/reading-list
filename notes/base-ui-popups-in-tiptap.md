# base-ui popups inside tiptap must be portaled to `body`

**Symptom.** A base-ui Menu/Dropdown rendered inside a ProseMirror NodeView
mounts in `document.body` and is removed ~2ms later. The orphaned trigger is
left with `aria-expanded="true"`. No transaction fires and the NodeView's
`update`/`destroy` are never called, so it doesn't look like an editor event
at all.

**Cause.** Opening the popup runs base-ui's `FloatingFocusManager`, whose
`markOthers` walks up from the trigger writing `data-base-ui-inert` /
`aria-hidden` onto every ancestor's siblings. With the trigger inside the
editor, those attributes land on ProseMirror's own content nodes — the code
block `<pre>`, sibling `<p>`s. ProseMirror's MutationObserver treats foreign
attribute writes on nodes it manages as content changes and rebuilds them
(`readDOMChange` → `updateState`), destroying the React NodeView and the open
popup in the same frame.

**What doesn't work.** `modal={false}` — `markOthers` still tags outside
content. A NodeView `ignoreMutation` — the inert writes also land on sibling
paragraphs owned by the root docView, not by the NodeView.

**Fix.** Render trigger *and* menu via `createPortal(..., document.body)` so
neither is a descendant of `.ProseMirror`. `markOthers` then only reaches the
app root, which ProseMirror doesn't observe. See the `LanguagePicker` in
[components/editor/code-block-node-view.tsx](../components/editor/code-block-node-view.tsx).

**Positioning gotcha.** The body-portaled chip is `position: fixed`, placed
from the NodeView wrapper's `getBoundingClientRect`. A one-shot or
ResizeObserver measurement goes stale when the detail panel slides in after
mount — a position-only shift emits no resize or scroll event, so the chip ends
up off-screen and the user sees no picker at all. Track the rect with a
`requestAnimationFrame` loop while the chip is visible, and no-op the state
update when the rect is unchanged so a stationary block doesn't re-render every
frame.

Diagnosed with the dev-only repro route at `app/debug/code-block` (linked from
the `/debug` index).
