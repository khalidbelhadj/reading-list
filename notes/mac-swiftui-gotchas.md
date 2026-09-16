# SwiftUI gotchas from the review port (2026-09-13)

Things that cost real time while porting review to the native app, none of
which the symptom pointed at.

## Environment set on a resolved subview never reaches a button style

`ButtonGroup` used `Group(subviews:)` and set `.environment(\.buttonGroupPosition, …)`
on each `subviews[index]` so the kit's button style could square the inner
corners. The buttons never saw it: every child kept its full rounding, and
the glass variant only *looked* joined because its children draw no
background of their own. Setting the environment on the row that contains
the subviews works. Rule: modifiers on a `Subview` value are fine for
layout, but don't rely on them to feed a child's `@Environment`.

## Two files with the same basename in one SwiftPM target

`Data/Flashcard.swift` (the model) next to `DesignKit/App/Flashcard.swift`
(the view) fails the build with "couldn't build … Flashcard.swift.o because
of multiple producers". Basenames must be unique per target, whatever the
directory. The model became `Card` in `Data/Deck.swift`.

## Ending an in-place edit

A SwiftUI `TextField` that gets focus programmatically selects all its
text, so the first keystroke replaces the side (this destroyed a card's
text during testing). `TextField(text:selection:)` with
`TextSelection(insertionPoint: text.endIndex)` set on appear puts the
caret at the end instead.

Clicking empty space in an AppKit-hosted SwiftUI window does not move
focus, so "click away to commit" never fires by itself. The card side runs
a local `NSEvent` monitor while editing: a mouse-down outside the field's
`.global` frame ends the edit (flip `locationInWindow` through the content
view's height to compare), Esc restores the original. Ending the edit means
setting the view's own state; resigning the first responder or writing
`@FocusState` from the monitor was not reliable. `.onExitCommand` on the
field did not fire either.

## Harness: `find` echoes its command line

`bun run mac find textfield` prints `$ bun scripts/mac.ts find textfield`
first, so `grep -c textfield` is never zero. Filter lines starting with `$`
before counting; the same applies to any other query word.

## Harness keys arrive one at a time

The debug `key` command posts one keyDown/keyUp pair. Two commands back to
back can land before the first has been handled by SwiftUI; give the UI a
beat between them when the second depends on state the first changes.

## Hosting the web editor in a WKWebView

- ES module scripts do not load from a `file://` page (cross-origin), and
  nothing says so: the page stays blank. Serve the bundle through a
  `WKURLSchemeHandler` on a scheme of the app's own instead.
- Tailwind v4's automatic source detection follows the Vite root. With the
  editor build rooted at `editor-host/`, none of `components/` was scanned
  and every utility used only there was missing, so the toolbar and code
  chrome lost their layout while the prose looked fine. A wrapper
  stylesheet with `@source "../components"` (and lib, app) fixes it.
- A native SwiftUI overlay over the web view can act on its selection: the
  page reports the selection's rect and marks, the app floats its bubble
  there, and each action calls back into the page. Clicking the native
  bubble does not blur the editor (SwiftUI buttons do not take first
  responder), so the selection survives the round trip.
