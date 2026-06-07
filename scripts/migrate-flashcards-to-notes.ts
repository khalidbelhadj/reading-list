// One-shot migration (issue #86, item 7): seed existing `flashcards` rows into
// their item's `notes` as inline `<card>` blocks, reusing each row's id, so the
// first notes→DB sync after the feature ships is a no-op.
//
// Safety:
//   - Dry-run by default. Pass `--apply` to write.
//   - Idempotent: cards already present in notes (by id) are skipped, so
//     re-running appends nothing new.
//   - Round-trip verified: after building an item's new notes, we re-parse with
//     the SAME parser sync uses and confirm every existing card is recovered
//     with matching content. An item where any card fails is left untouched and
//     reported — the sync delete-pass must never be able to drop a real card.
//   - Snapshots pre-migration notes to a JSON file for rollback
//     (`--rollback <file>` restores them).
import "@/lib/env";
import { writeFileSync, readFileSync } from "node:fs";
import postgres from "postgres";

import { parseCardsFromNotes } from "@/lib/card-parse";
import { BLANK_LINE_SENTINEL, stripBlankLineSentinel } from "@/lib/markdown";

const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

const clean = (value: string | null) =>
  stripBlankLineSentinel(value ?? "").trim();

// Card block in the editor's tag-per-line form. Empty sides use the blank-line
// sentinel so the editor renders a valid (non-empty) paragraph; the parser
// strips it back to "".
const buildBlock = (id: string, front: string, back: string) => {
  const f = front === "" ? BLANK_LINE_SENTINEL : front;
  const b = back === "" ? BLANK_LINE_SENTINEL : back;
  return `<card id="${id}">\n<front>\n${f}\n</front>\n<back>\n${b}\n</back>\n</card>`;
};

type Row = { id: string; item_id: string; front: string; back: string; notes: string | null };

const rollback = async (file: string) => {
  const snapshot = JSON.parse(readFileSync(file, "utf8")) as Record<string, string | null>;
  const entries = Object.entries(snapshot);
  console.log(`Rolling back ${entries.length} item(s) from ${file}`);
  for (const [itemId, notes] of entries) {
    await sql`UPDATE items SET notes = ${notes} WHERE id = ${itemId}`;
  }
  console.log("Rollback complete.");
  await sql.end();
};

const migrate = async (apply: boolean) => {
  const rows = (await sql`
    SELECT f.id, f.item_id, f.front, f.back, i.notes
    FROM flashcards f
    JOIN items i ON i.id = f.item_id
    ORDER BY f.created_at ASC
  `) as unknown as Row[];

  const orphans = (await sql`
    SELECT count(*)::int AS n FROM flashcards WHERE item_id IS NULL
  `) as unknown as { n: number }[];

  // Group rows by item.
  const byItem = new Map<string, { notes: string | null; cards: Row[] }>();
  for (const row of rows) {
    const entry = byItem.get(row.item_id) ?? { notes: row.notes, cards: [] };
    entry.cards.push(row);
    byItem.set(row.item_id, entry);
  }

  const snapshot: Record<string, string | null> = {};
  const writes: { itemId: string; notes: string; trims: Row[] }[] = [];
  let skippedAlready = 0;
  let appendedCards = 0;
  const unsafe: { itemId: string; cardId: string; reason: string }[] = [];

  for (const [itemId, { notes, cards }] of byItem) {
    const present = new Set(parseCardsFromNotes(notes ?? "").map((c) => c.id));
    const toAppend = cards.filter((c) => !present.has(c.id));
    if (toAppend.length === 0) {
      skippedAlready++;
      continue;
    }

    // Trim content so notes and DB agree exactly (a strict first-sync no-op).
    const trims = toAppend.filter(
      (c) => c.front !== clean(c.front) || c.back !== clean(c.back),
    );
    const blocks = toAppend.map((c) =>
      buildBlock(c.id, clean(c.front), clean(c.back)),
    );
    const base = (notes ?? "").trimEnd();
    const newNotes = base ? `${base}\n\n${blocks.join("\n\n")}` : blocks.join("\n\n");

    // Verify every appended card round-trips through the real parser.
    const reparsed = new Map(parseCardsFromNotes(newNotes).map((c) => [c.id, c]));
    let safe = true;
    for (const c of toAppend) {
      const got = reparsed.get(c.id);
      if (!got) {
        unsafe.push({ itemId, cardId: c.id, reason: "not recovered after merge" });
        safe = false;
      } else if (got.front !== clean(c.front) || got.back !== clean(c.back)) {
        unsafe.push({ itemId, cardId: c.id, reason: "content mismatch after merge (likely a delimiter line in content)" });
        safe = false;
      }
    }
    if (!safe) continue;

    snapshot[itemId] = notes;
    writes.push({ itemId, notes: newNotes, trims });
    appendedCards += toAppend.length;
  }

  console.log("─".repeat(60));
  console.log(`Items with flashcards:        ${byItem.size}`);
  console.log(`Items already migrated:       ${skippedAlready}`);
  console.log(`Items to write:               ${writes.length}`);
  console.log(`Cards to append:              ${appendedCards}`);
  console.log(`Orphan flashcards (no item):  ${orphans[0]?.n ?? 0} (left untouched)`);
  if (unsafe.length > 0) {
    console.log(`\n⚠️  ${unsafe.length} card(s) FAILED round-trip — their items are NOT written:`);
    for (const u of unsafe) console.log(`   item ${u.itemId} card ${u.cardId}: ${u.reason}`);
  }
  console.log("─".repeat(60));

  if (!apply) {
    const sample = writes[0];
    if (sample) {
      const before = (byItem.get(sample.itemId)?.notes ?? "").trim() || "(empty)";
      console.log(`\nPREVIEW — item ${sample.itemId}`);
      console.log("  BEFORE notes:\n" + before.split("\n").map((l) => "    " + l).join("\n"));
      console.log("  AFTER notes:\n" + sample.notes.split("\n").map((l) => "    " + l).join("\n"));
      console.log("─".repeat(60));
    }
    console.log("DRY RUN — no changes written. Re-run with --apply to migrate.");
    await sql.end();
    return;
  }

  const snapshotFile = `scripts/flashcard-migration-snapshot.json`;
  writeFileSync(snapshotFile, JSON.stringify(snapshot, null, 2));
  console.log(`Snapshot written to ${snapshotFile} (use --rollback <file> to restore).`);

  for (const { itemId, notes, trims } of writes) {
    await sql`UPDATE items SET notes = ${notes}, updated_at = now() WHERE id = ${itemId}`;
    for (const c of trims) {
      await sql`UPDATE flashcards SET front = ${clean(c.front)}, back = ${clean(c.back)}, updated_at = now() WHERE id = ${c.id}`;
    }
  }
  console.log(`Applied: wrote ${writes.length} item(s), appended ${appendedCards} card(s).`);
  await sql.end();
};

const main = async () => {
  const rollbackIdx = process.argv.indexOf("--rollback");
  if (rollbackIdx !== -1) {
    const file = process.argv[rollbackIdx + 1];
    if (!file) throw new Error("--rollback requires a snapshot file path");
    await rollback(file);
    return;
  }
  await migrate(process.argv.includes("--apply"));
};

main().catch(async (err) => {
  console.error(err);
  await sql.end();
  process.exit(1);
});
