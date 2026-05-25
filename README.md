# Reading list application with spaced repetition

https://reading-list.khalidbelhadj.com/

An application to track bookmarks and reading list items, take notes, and create spaced-repetition cards. The main form of interaction is through the UI, but a fully integrated MCP server is available. The intent is to use this app as a source of truth for knowledge gathered from reading online material and chatting with an LLM about it.

```sh
bun install
bun run db:push
bun dev   # needs DATABASE_URL in .env.local
```
<img width="1824" height="1246" alt="Screenshot 2026-05-03 at 1 42 01 pm" src="https://github.com/user-attachments/assets/851ee094-238c-41b0-815d-82d606766828" />

---

UI fixes:
- notes links should be blue
- image loading ui is not good
- line for dragging images should be nicer
- fix the skeleton for the item page, sizes of the rows
- highlighting images should show in the image

- primary buttons look bigger than ghost ones

Functional fixes:
- deleting list item leaves a gap, and splits the list in two

Features requests:
- We should have an "archived", then have a cleanup routine
- In-app AI features
    - We need native llm features, I way to run a (useful) agent to convert my stuff to flashcards, maybe a versioning and approval flow sort of thing.
- Another llm flow I would like is having the reader open and asking questions and the model points me to the right place, draws diagrams, explains things inline. This would be sick with a voice model too (speech to text) and maybe text to speech. We need a good in app reader experience though.
- Content in-app
    - support PDF uploads
    - automatically download arxiv pdfs
    - pdf highlighting
    - content extraction for AI context
- hybrid in-memory and sql search so that it feels snappy
    - we have the data in the front end! how can we make it super quick and how can we show that it's doing a shallow search and the deep search is coming. Claude desktop does this well, the ui
- Recents section with a horizontal list of cards

Fundamental issues:
- I feel like I constantly need to briefly navigate forward and backward
- We should improve the mobile experience, or just write a mobile native app