// Stable 8-char id shared by inline `<card>` blocks in notes and their
// corresponding `flashcards` rows. The id round-trips through the notes
// markdown, so it must be generated identically wherever cards are created
// (editor insert) or reconciled (notes→DB sync).
export const newCardId = (): string => {
  const raw =
    globalThis.crypto?.randomUUID?.() ??
    Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  return raw.replace(/-/g, "").slice(0, 8);
};
