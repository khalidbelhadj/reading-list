# The pdf.js `measureText` freeze (2026-07-29)

**Symptom.** Scrolling or resizing a dense PDF in the reader froze the whole
window for seconds at a time. Worse on text-heavy arXiv papers, and it scaled
with *document* size rather than with what was on screen.

**Cause.** pdf.js measures glyph widths with a canvas whose host element was
attached to the live document. Every `measureText` call on an attached canvas
forces the browser to flush pending style and layout for the *entire* document
before it can answer — so one measurement per text span became a full-document
style recalculation per span. The cost compounded with the number of spans in
the PDF, which is why bigger documents froze harder.

**Fix.** Build the measurement host detached from the document, and detach any
measurement canvases pdf.js creates (`detachPdfMeasureCanvases`). A detached
canvas has no layout to flush, so `measureText` answers immediately.

**How it was found.** The browser preview cannot reproduce this at all — its
tab reports `document.hidden = true` and rAF is fully paused, and the viewer
pipeline is rAF-driven, so nothing runs. It needed the real Electron app: CPU
profiles over CDP (`Profiler.start/stop`, sampling interval 200), analyzed by
self-time, then walking `parentOf` chains to recover the call path. See
[electron-debugging.md](electron-debugging.md) for how to attach.

**Generalises to:** any `measureText` / `getBoundingClientRect` /
`offsetWidth` call in a hot loop. If the element is in the document, you are
paying for a layout flush every iteration. Measure detached, or measure once
and cache.
