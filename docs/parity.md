# Feature parity

One product, three shells: the web app, the Electron wrapper around it, and
the native Mac app. Every feature is listed here with where it exists. A
change that adds or removes a feature updates this table in the same
commit, and a gap it opens gets a row with a plan.

Electron shows the web app, so it inherits every web row; its own column
only lists what it adds. `bun run check` enforces the one row a script can
check: every kit component on the web board has a demo on the Mac board.

Legend: ✓ done · ◐ partial · ✗ missing · — not applicable

| Area | Feature | Web | Electron adds | Mac | Notes |
| --- | --- | --- | --- | --- | --- |
| Shell | Reading list, item, review views with back/forward history | ✓ | | ✓ | |
| Shell | Land on Review | ✓ | | ✗ | S |
| Shell | Persisted sidebar width and open state | ✓ | | ◐ | system split view; not persisted across launches |
| Shell | List scroll position kept across views | ✓ | | ✗ | S |
| Shell | ⌘K palette with recents and search | ✓ | | ◐ | local title/url filter only |
| Shell | Deep link `readinglist://item/<id>` | | ✓ | ✗ | scheme registered; S |
| Shell | Paste-to-create (⌘V anywhere) | ✓ | | ✗ | S |
| Sidebar | New item, clipboard paste affordance | ✓ | | ✓ | |
| Sidebar | Reading list, Review (due count), Mental maths places | ✓ | | ◐ | Mental maths missing; `showMentalMaths` synced but unused |
| Sidebar | Starred, Recent, hover preview card | ✓ | | ✓ | |
| Sidebar | Open-in-browser tabs group | | ✓ | ✗ | needs Apple Events; M |
| List | Search with instant local pass | ✓ | | ✓ | |
| List | Server search over notes and cards, regex | ✓ | | ✗ | route exists; S |
| List | Ask (agentic search) | ✓ | | ✗ | see Index |
| List | View options: read, grouping, sort, density | ✓ | | ✓ | from the shared settings |
| List | Date groups, starred section, preview rows with thumbnails | ✓ | | ✓ | |
| Item | Title and link editing, retitle after a link change | ✓ | | ✓ | |
| Item | Notes editor: markdown, code, math, cards, images, bubble | ✓ | | ✓ | the web editor hosted in a web view, native glass bubble |
| Item | Jump to a card inside the notes from review | ✓ | | ✗ | M |
| Item | Star, read, hide, delete, open link, copy link | ✓ | | ✓ | |
| Item | Chat with Claude (`claude://`) | ✓ | | ✗ | S |
| Item | Go to browser tab | | ✓ | ✗ | with open tabs |
| Review | Due and New queues, ratings 1 to 4, Space, S | ✓ | | ✓ | |
| Review | Item-scoped review (due / all) | ✓ | | ✓ | |
| Review | In-place card editing through the notes | ✓ | | ✓ | |
| Review | Deck (all cards) | ✓ | | ✓ | |
| Review | Topic mode (agent-compiled stack) | ✓ | | ✗ | see Index |
| Review | Review stack from Ask results | ✓ | | ✗ | see Index |
| Mental maths | Setup, run, summary, history | ✓ | | ✗ | charts ported; M |
| Settings | Server-synced settings blob | ✓ | | ✓ | `SettingsStore`, debounced patches |
| Settings | Theme override, sounds toggle | ✓ | | ✓ | gear menu |
| Settings | Export CSV | ✓ | | ✗ | S |
| Settings | Version pane | ✓ | | ✗ | S |
| Settings | Account: initials, copy user id, sign out everywhere | ✓ | | ◐ | email and sign out only |
| Index | Client-side index worker and embeddings | ✓ | | ✗ | architectural: model runs in the browser; XL |
| Index | Ask and Topic agents | ✓ | | ✗ | depends on the index |
| Auth | Google sign-in | ✓ | ✓ | ✓ | one browser-and-deep-link flow for both desktop apps |
| Auth | Dev user sign-in on the local stack | ✓ | | ✓ | |
| Auth | Session in the Keychain (release) | — | | ✓ | file storage in dev builds |
| Data | Optimistic writes with rollback | ✓ | | ✓ | |
| Data | Cross-device sync over Realtime | ✓ | | ✓ | |
| Data | Offline first paint from a disk snapshot | ✗ | | ✓ | Mac only |
| Platform | Window vibrancy | | ✓ | ✓ | native glass |
| Platform | Zoom (⌘0 ⌘+ ⌘-) | | ✓ | ✗ | S |
| Dev | Dev banner / dev bar with state previews | ✓ | | ✓ | |
| Dev | Design board | ✓ | | ✓ | parity checked by `bun run check` |
| Dev | Harness (drive the real app) | | ✓ `bun run cdp` | ✓ `bun run mac` | same verbs, see docs/dev.md |
