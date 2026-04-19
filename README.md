# Reading list application with spaced repetition

An application to track bookmarks and reading list items, take notes, and create spaced-repetition cards. The main form of interaction is through the UI, but a fully integrated MCP server is available. The intent is to use this app as a source of truth for knowledge gathered from reading online material and chatting with an LLM about it.

```sh
bun install
bun run db:push
bun dev   # needs DATABASE_URL in .env.local
```


