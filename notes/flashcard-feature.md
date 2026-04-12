# Flashcard Feature

## North Star

A flashcard system embedded in the reading list app where cards are a natural byproduct of consuming content — not a separate activity. The system should feel like: **save item → read it → tap "generate cards" → accept the good ones → review a few cards when you open the app.**

## Product Requirements

### Card Creation

- Generate flashcards from any item via LLM — using page content, your notes, or both
- Generate without notes (LLM extracts key concepts from content)
- Generate with notes (your bullets guide what cards cover)
- Manual card creation (write your own Q/A pair)
- Re-running generation on an item shows new proposals, with existing cards passed to the LLM to avoid duplicates
- Proposed cards shown in a review flow: accept, edit, or reject each one
- Cards are linked to their source item

### Card Review

- Spaced repetition scheduling (SM-2 or similar algorithm)
- Short default sessions (5 cards)
- Review mode accessible from the main app — not a separate tool
- Each card shows its source item for context, tappable to navigate back
- Rate each card: "good" / "again" (keep it simple, 2 buttons)

### Settings & Tuning

- Editable system prompt for card generation in settings
- Card style preference (Q/A, cloze deletion, or mix)
- Default number of cards per generation

### Notes (prerequisite)

- Freeform bullet notes per item
- Quick to add — inline or via the side panel

## Implementation Steps

1. **Notes on items** — add a `notes` text field to the item schema/UI (or surface the existing one). Inline editing, plain bullets.

2. **Flashcard schema** — new `flashcards` table: id, itemId (FK), front, back, easeFactor, interval, nextReviewAt, createdAt. Migration + server actions for CRUD.

3. **Flashcard generation backend** — server action that takes an item (content/URL + notes + existing cards) and calls Claude API to propose cards. Editable system prompt stored in a settings table or localStorage.

4. **Card proposal UI** — "Generate flashcards" button on items. Shows proposed cards in a reviewable list: accept/edit/reject. Accepted cards saved to DB.

5. **Review mode UI** — accessible from main nav. Pulls due cards (nextReviewAt <= now), shows front, flip to reveal back, rate good/again. SM-2 updates interval + next review date.

6. **Generation settings UI** — settings page exposing the system prompt, card style preference, and default count.

7. **Polish** — review prompt on app open ("5 cards due"), keyboard shortcuts for review, card count badges.
