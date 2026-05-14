---
name: review
description: Review changed code for quality, bugs, and adherence to project conventions
---

Review the changed files in this project for code quality issues and bugs.

**Agent assumptions (applies to all agents and subagents):**
- All tools are functional and will work without error. Do not test tools or make exploratory calls.
- Only call a tool if it is required to complete the task. Every tool call should have a clear purpose.

To do this, follow these steps precisely:

1. Launch a haiku agent to return a list of file paths (not their contents) for all relevant CLAUDE.md files including:
   - The root CLAUDE.md file, if it exists
   - Any CLAUDE.md files in directories containing modified files

2. Launch a sonnet agent to get `git diff` of staged and unstaged changes and return a summary of what changed.

3. Launch 4 agents in parallel to independently review the changes. Each agent should return the list of issues, where each issue includes a description, file path, line number, and the reason it was flagged. The agents should do the following:

   Agents 1 + 2: CLAUDE.md compliance sonnet agents
   Audit changes for CLAUDE.md compliance in parallel. When evaluating compliance for a file, only consider CLAUDE.md files that share a file path with the file or parents.

   Agent 3: Opus bug agent (parallel with agent 4)
   Scan for obvious bugs. Focus only on the diff itself without reading extra context. Flag only significant bugs; ignore nitpicks and likely false positives.

   Agent 4: Opus convention agent (parallel with agent 3)
   Check for violations of project conventions:
   - All server action calls must use `useMutation` or `useQuery` — never bare `await` in components
   - Component ordering: data/queries → UI state → refs → helpers → hooks → mutations/callbacks → effects → derived state → render
   - Use shadcn `Button` for all buttons, never raw `<button>` (raw `<input>`/`<textarea>` ok for unstyled inline fields)
   - All component functions should be `const` with `useCallback` when passed as props, no `function` declarations
   - Full variable names (`searchQuery` not `q`), single-letter vars only in `.map()/.filter()` chains
   - Extract complex inline JSX logic into `const` or `useMemo` above the return
   - Prefer inline map: `items.map((item) => (<X />))` not `items.map((item) => { return (<X />) })`
   - No dead code: unused imports, commented-out code, stale TODOs, unused variables
   - No Tailwind conflicts (e.g. `relative` with `sticky`)
   - No `eslint-disable` comments — fix the underlying issue instead

   Flag ALL issues including:
   - Bugs: syntax errors, type errors, missing imports, logic errors
   - Convention violations: quote the exact rule being broken
   - Nits: naming, formatting, unnecessary complexity, verbose patterns that could be simpler
   - Suggestions: better approaches, cleaner patterns, missing error handling

   Categorize each issue as: `bug`, `convention`, `nit`, or `suggestion`.

   Do NOT flag:
   - Pre-existing issues not in the diff
   - Issues already covered by an eslint rule that will catch it automatically

4. For each `bug` or `convention` issue found in step 3 by agents 3 and 4, launch parallel subagents to validate the issue. The agent's job is to review the issue to validate that the stated issue is truly an issue with high confidence. Use Opus subagents for bugs, sonnet for convention violations. Nits and suggestions do not need validation.

5. Filter out any `bug`/`convention` issues that were not validated in step 4. Keep all nits and suggestions.

6. Output a summary of the review findings to the terminal grouped by category:
   - **Bugs** (if any)
   - **Convention violations** (if any)
   - **Nits** (if any)
   - **Suggestions** (if any)
   
   For each issue: file path, line number, description, and suggested fix.
   If no issues at all: "No issues found. Checked for bugs, conventions, nits, and CLAUDE.md compliance."
