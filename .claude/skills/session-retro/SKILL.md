---
name: session-retro
description: Analyze the current session to find patterns of inefficiency and extract improvements for CLAUDE.md, skills, and prompting habits
---

Analyze this session's collaboration patterns to find workflow inefficiencies. Focus on the interaction dynamics — how requests were made, how work was structured, where misalignment happened — not on individual code bugs.

## Step 1: Gather data (launch 4 agents in parallel)

**Agent 1 (sonnet): Direction changes**
Scan the conversation for every instance where the user redirected, corrected, or said "no" / "not that" / "actually" / "wait" / interrupted. For each, note:
- What the agent was doing
- What the user wanted instead
- How many messages it took to get aligned
- Whether the misalignment was about WHAT to build or HOW to build it

**Agent 2 (sonnet): Wasted work**
Find every instance where code was written and then deleted, reverted, or substantially rewritten in the same session. Estimate rough effort (small/medium/large). Categorize:
- Threw away a whole feature (built then removed)
- Had to redo an approach (wrong technique, right goal)
- Cosmetic iteration (back and forth on styling/values)
- Fixed own bug (introduced then fixed)

**Agent 3 (sonnet): Prompting patterns**
Analyze the USER's prompting style. Look for:
- Were requests specific enough? Too vague? Too detailed?
- Did the user batch related requests or drip-feed them one at a time?
- Were there places where a single upfront prompt could have replaced 5+ back-and-forth messages?
- Did the user give enough context about their preferences/taste upfront?
- Were there assumptions the user expected the agent to know but hadn't stated?

**Agent 4 (sonnet): Agent behavior patterns**
Analyze the AGENT's behavior. Look for:
- Did the agent ask clarifying questions when it should have, or just guess?
- Did the agent over-engineer solutions that the user then simplified?
- Did the agent under-engineer, requiring the user to ask for more?
- Were plans/approaches proposed before coding, or did the agent just start building?
- Did the agent pick up on implicit preferences or miss them?
- How many iterations did it take to match the user's taste/vision on average?

## Step 2: Synthesize (do this yourself, not a subagent)

From the 4 agents' findings, identify **3-7 high-level patterns** about how this session's collaboration could have been more efficient. These should be about workflow and interaction, not about specific code decisions. Think about:

- Information that was missing at the start but needed throughout
- Decisions that should have been made upfront but were made incrementally
- Work that could have been parallelized or batched
- Places where the wrong level of autonomy was used (agent decided when it should have asked, or asked when it should have decided)
- Taste/preference signals that took too long to surface

## Step 3: Output

For each pattern:

- **What happened** — Describe the pattern in plain language, with examples from the session
- **Why it happened** — Was it a missing rule, a prompting habit, a missing skill, a wrong default, or a structural issue?
- **Recommendation** — One concrete, actionable change. Be specific:
  - If it's a CLAUDE.md rule, write the exact text
  - If it's a skill, describe what it does and when to invoke it
  - If it's a prompting tip for the user, explain what to do differently and why
  - If it's a memory to save, write it out
  - If it's a hook or config change, describe the setup
- **Expected impact** — How many messages/iterations this would save in a typical session

Keep it honest and practical. Every recommendation should pass the test: "Would this actually change behavior next time?"
