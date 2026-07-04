// `@/db` creates a postgres client and runs the MOCK_USER_ID env guard at
// import time. The sync logic under test never touches the real client (the DB
// path is exercised with a fake tx below), so stub the module out.
jest.mock("@/db", () => ({ db: {} }));

import {
  parseCardsFromNotes,
  normalizeCardIds,
  diffCards,
  syncFlashcardsFromNotes,
  MAX_CARD_FIELD_LENGTH,
  type ExistingCard,
  type ParsedCard,
} from "@/lib/flashcard-sync";

// Build the exact markdown the editor serializes for a card: each tag on its
// own line at column 0, front/back content in between.
const card = (id: string | null, front: string, back: string) =>
  `<card${id === null ? "" : ` id="${id}"`}>\n<front>\n${front}\n</front>\n<back>\n${back}\n</back>\n</card>`;

describe("parseCardsFromNotes", () => {
  it("parses a single card's id, front, and back", () => {
    const [c, ...rest] = parseCardsFromNotes(
      card("abc12345", "What is 2+2?", "4"),
    );
    expect(rest).toHaveLength(0);
    expect(c).toEqual({ id: "abc12345", front: "What is 2+2?", back: "4" });
  });

  it("parses multiple cards in document order", () => {
    const notes = `${card("aaa00001", "q1", "a1")}\n\n${card("bbb00002", "q2", "a2")}`;
    const result = parseCardsFromNotes(notes);
    expect(result.map((r) => r.id)).toEqual(["aaa00001", "bbb00002"]);
  });

  it("preserves multi-line front and back content", () => {
    const [c] = parseCardsFromNotes(
      card("multi001", "line one\nline two", "- a\n- b"),
    );
    if (!c) throw new Error("expected a parsed card");
    expect(c.front).toBe("line one\nline two");
    expect(c.back).toBe("- a\n- b");
  });

  it("treats an empty card (blank-line sentinel) as empty strings", () => {
    const [c] = parseCardsFromNotes(card("empt0001", "&nbsp;", "&nbsp;"));
    if (!c) throw new Error("expected a parsed card");
    expect(c.front).toBe("");
    expect(c.back).toBe("");
  });

  it("returns id null when the <card> tag has no id attribute", () => {
    const [c] = parseCardsFromNotes(card(null, "q", "a"));
    if (!c) throw new Error("expected a parsed card");
    expect(c.id).toBeNull();
  });

  it("ignores an unterminated <card> block", () => {
    expect(parseCardsFromNotes('<card id="x">\n<front>\nq\n</front>')).toEqual(
      [],
    );
  });

  it("returns empty back when the <back> side is absent", () => {
    const [c] = parseCardsFromNotes(
      '<card id="nf000001">\n<front>\nq\n</front>\n</card>',
    );
    if (!c) throw new Error("expected a parsed card");
    expect(c.front).toBe("q");
    expect(c.back).toBe("");
  });

  describe("delimiter-looking text in content (A.3 robustness)", () => {
    it("does not break on </card> inside a code block", () => {
      const notes = card(
        "code0001",
        '```\nparse("</card>")\n```',
        "the answer",
      );
      const result = parseCardsFromNotes(notes);
      expect(result).toHaveLength(1);
      const [c] = result;
      if (!c) throw new Error("expected a parsed card");
      expect(c.front).toBe('```\nparse("</card>")\n```');
      expect(c.back).toBe("the answer");
    });

    it("does not break on </card> in inline code", () => {
      const [c] = parseCardsFromNotes(
        card("inl00001", "`</card>` closes it", "yes"),
      );
      if (!c) throw new Error("expected a parsed card");
      expect(c.front).toBe("`</card>` closes it");
      expect(c.back).toBe("yes");
    });

    it("does not truncate the front on a mid-line </front>", () => {
      const [c] = parseCardsFromNotes(
        card("mid00001", "`</front>` ends front", "ok"),
      );
      if (!c) throw new Error("expected a parsed card");
      expect(c.front).toBe("`</front>` ends front");
    });

    it("does not treat a code-fenced </front> as the closing tag", () => {
      const [c] = parseCardsFromNotes(
        card("fen00001", "```\n</front>\n```", "back text"),
      );
      if (!c) throw new Error("expected a parsed card");
      expect(c.front).toBe("```\n</front>\n```");
      expect(c.back).toBe("back text");
    });

    it("ignores a <card> block shown inside a top-level code fence", () => {
      const notes = `\`\`\`\n${card("fake0001", "q", "a")}\n\`\`\``;
      expect(parseCardsFromNotes(notes)).toEqual([]);
    });
  });
});

describe("normalizeCardIds", () => {
  it("regenerates duplicate ids, keeping the first and flagging change", () => {
    const notes = `${card("dup00001", "A", "1")}\n\n${card("dup00001", "B", "2")}`;
    const { notes: out, changed } = normalizeCardIds(notes);
    expect(changed).toBe(true);
    const ids = parseCardsFromNotes(out).map((c) => c.id);
    expect(ids[0]).toBe("dup00001");
    expect(ids[1]).not.toBe("dup00001");
    expect(new Set(ids).size).toBe(2);
  });

  it("assigns an 8-char id to a card that has none", () => {
    const { notes: out, changed } = normalizeCardIds(card(null, "q", "a"));
    expect(changed).toBe(true);
    const [c] = parseCardsFromNotes(out);
    if (!c) throw new Error("expected a parsed card");
    expect(typeof c.id).toBe("string");
    expect(c.id).toHaveLength(8);
  });

  it("leaves already-unique ids untouched", () => {
    const notes = `${card("stable01", "q", "a")}\n\n${card("stable02", "q", "a")}`;
    expect(normalizeCardIds(notes)).toEqual({ notes, changed: false });
  });

  it("does not rewrite a <card> tag shown inside a code fence", () => {
    const notes = `\`\`\`\n${card("dup00001", "q", "a")}\n\`\`\`\n\n${card("dup00001", "real", "card")}`;
    const { changed } = normalizeCardIds(notes);
    expect(changed).toBe(false);
  });
});

describe("diffCards", () => {
  const existing: ExistingCard[] = [
    { id: "keep1", front: "old", back: "o" },
    { id: "same1", front: "unchanged", back: "z" },
    { id: "empty1", front: "e", back: "f" },
    { id: "gone1", front: "x", back: "y" },
  ];

  it("inserts a card with no existing row", () => {
    const d = diffCards([{ id: "new1", front: "hi", back: "yo" }], []);
    expect(d.toInsert).toEqual([{ id: "new1", front: "hi", back: "yo" }]);
  });

  it("updates a card whose content changed", () => {
    const d = diffCards([{ id: "keep1", front: "new", back: "o" }], existing);
    expect(d.toUpdate).toEqual([{ id: "keep1", front: "new", back: "o" }]);
  });

  it("does not update a card whose content is unchanged", () => {
    const d = diffCards(
      [{ id: "same1", front: "unchanged", back: "z" }],
      existing,
    );
    expect(d.toUpdate).toHaveLength(0);
  });

  it("deletes a row whose card was cleared to empty", () => {
    const d = diffCards([{ id: "empty1", front: "", back: "" }], existing);
    expect(d.toDelete).toContain("empty1");
  });

  it("deletes a row whose card was removed from the notes", () => {
    const d = diffCards(
      [{ id: "same1", front: "unchanged", back: "z" }],
      existing,
    );
    expect(d.toDelete).toEqual(
      expect.arrayContaining(["keep1", "empty1", "gone1"]),
    );
    expect(d.toDelete).not.toContain("same1");
  });

  it("does not create a row for an empty new card", () => {
    const d = diffCards([{ id: "e2", front: "", back: "" }], []);
    expect(d.toInsert).toHaveLength(0);
    expect(d.toDelete).toHaveLength(0);
  });

  it("skips an oversize card and leaves its existing row untouched", () => {
    const big = "x".repeat(MAX_CARD_FIELD_LENGTH + 1);
    const parsed: ParsedCard[] = [{ id: "keep1", front: big, back: "o" }];
    const d = diffCards(parsed, existing);
    expect(d.skippedOversize).toEqual(["keep1"]);
    expect(d.toUpdate).toHaveLength(0);
    expect(d.toDelete).not.toContain("keep1");
  });

  it("skips an oversize new card without inserting it", () => {
    const parsed: ParsedCard[] = [
      { id: "big1", front: "x".repeat(MAX_CARD_FIELD_LENGTH + 1), back: "" },
    ];
    const d = diffCards(parsed, []);
    expect(d.skippedOversize).toEqual(["big1"]);
    expect(d.toInsert).toHaveLength(0);
  });

  it("ignores a parsed card with a null id", () => {
    const d = diffCards([{ id: null, front: "q", back: "a" }], []);
    expect(d.toInsert).toHaveLength(0);
  });
});

describe("syncFlashcardsFromNotes", () => {
  type Row = Record<string, unknown>;
  const makeTx = (existing: ExistingCard[]) => {
    const rec = { inserted: [] as Row[], updated: [] as Row[], deleteCalls: 0 };
    const tx = {
      select: () => ({
        from: () => ({ where: () => Promise.resolve(existing) }),
      }),
      insert: () => ({
        values: (rows: Row[]) => {
          rec.inserted.push(...rows);
          return Promise.resolve();
        },
      }),
      update: () => ({
        set: (s: Row) => ({
          where: () => {
            rec.updated.push(s);
            return Promise.resolve();
          },
        }),
      }),
      delete: () => ({
        where: () => {
          rec.deleteCalls++;
          return Promise.resolve();
        },
      }),
    };
    return { tx, rec };
  };

  type SyncTx = Parameters<typeof syncFlashcardsFromNotes>[0];

  it("inserts a new card using its stable 8-char id and the item/user scope", async () => {
    const { tx, rec } = makeTx([]);
    const result = await syncFlashcardsFromNotes(
      tx as unknown as SyncTx,
      "user-1",
      "item-1",
      card("stable01", "Q", "A"),
    );

    expect(rec.inserted).toHaveLength(1);
    const insertedRow = rec.inserted[0];
    if (!insertedRow) throw new Error("expected an inserted row");
    expect(insertedRow).toMatchObject({
      id: "stable01",
      userId: "user-1",
      itemId: "item-1",
      front: "Q",
      back: "A",
    });
    expect(typeof insertedRow.createdAt).toBe("string");
    expect(typeof insertedRow.updatedAt).toBe("string");
    expect(result.diff.toInsert).toHaveLength(1);
  });

  it("updates a changed card and does not insert or delete", async () => {
    const { tx, rec } = makeTx([{ id: "keep1", front: "old", back: "o" }]);
    await syncFlashcardsFromNotes(
      tx as unknown as SyncTx,
      "user-1",
      "item-1",
      card("keep1", "new", "o"),
    );
    expect(rec.updated).toHaveLength(1);
    expect(rec.updated[0]).toMatchObject({ front: "new", back: "o" });
    expect(rec.inserted).toHaveLength(0);
    expect(rec.deleteCalls).toBe(0);
  });

  it("deletes rows for cards removed from the notes", async () => {
    const existing: ExistingCard[] = [
      { id: "keep1", front: "q", back: "a" },
      { id: "gone1", front: "x", back: "y" },
    ];
    const { tx, rec } = makeTx(existing);
    const result = await syncFlashcardsFromNotes(
      tx as unknown as SyncTx,
      "user-1",
      "item-1",
      card("keep1", "q", "a"),
    );
    expect(rec.deleteCalls).toBe(1);
    expect(result.diff.toDelete).toEqual(["gone1"]);
  });

  it("returns normalized notes when duplicate ids were rewritten", async () => {
    const { tx } = makeTx([]);
    const notes = `${card("dup00001", "A", "1")}\n\n${card("dup00001", "B", "2")}`;
    const result = await syncFlashcardsFromNotes(
      tx as unknown as SyncTx,
      "user-1",
      "item-1",
      notes,
    );
    expect(result.normalizedNotes).not.toBeNull();
    const ids = parseCardsFromNotes(result.normalizedNotes as string).map(
      (c) => c.id,
    );
    expect(new Set(ids).size).toBe(2);
  });

  it("returns null normalized notes when ids are already stable", async () => {
    const { tx } = makeTx([]);
    const result = await syncFlashcardsFromNotes(
      tx as unknown as SyncTx,
      "user-1",
      "item-1",
      card("stable01", "Q", "A"),
    );
    expect(result.normalizedNotes).toBeNull();
  });

  it("performs no writes for notes without cards", async () => {
    const { tx, rec } = makeTx([]);
    const result = await syncFlashcardsFromNotes(
      tx as unknown as SyncTx,
      "user-1",
      "item-1",
      "just some notes\n\nno cards here",
    );
    expect(rec.inserted).toHaveLength(0);
    expect(rec.updated).toHaveLength(0);
    expect(rec.deleteCalls).toBe(0);
    expect(result.diff.toInsert).toHaveLength(0);
  });
});
