// Shared server-side DB helpers: the auth + RLS-transaction ritual and the
// common ownership/join fragments used across app/actions and lib impls.
import { and, eq, type SQL } from "drizzle-orm";

import { type Tx, withUser } from "@/db";
import { flashcards, items } from "@/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import { ActionError } from "@/lib/safe-action";

// The standard action preamble: resolve the current user, then run `fn`
// inside a withUser (RLS-impersonated) transaction. Use the explicit
// getCurrentUserId + withUser pair only when the userId is also needed
// outside the transaction.
export const withCurrentUser = async <T>(
  fn: (tx: Tx, userId: string) => Promise<T>,
  label?: string,
): Promise<T> => {
  const userId = await getCurrentUserId();
  return withUser(userId, (tx) => fn(tx, userId), label);
};

// Auth gate for actions that discard the user id (e.g. cross-user pipeline
// controls): any signed-in user may call, nobody else.
export const requireAuth = async (): Promise<void> => {
  await getCurrentUserId();
};

// Throws unless `itemId` exists and belongs to `userId`.
export const assertOwnedItem = async (
  tx: Tx,
  userId: string,
  itemId: string,
): Promise<void> => {
  const [owned] = await tx
    .select({ id: items.id })
    .from(items)
    .where(and(eq(items.id, itemId), eq(items.userId, userId)))
    .limit(1);
  if (!owned) throw new ActionError("Item not found.");
};

// Join condition for enriching flashcards with their (user-owned) item via
// leftJoin — orphan cards survive as null item columns.
export const flashcardItemJoin = (userId: string): SQL =>
  and(eq(flashcards.itemId, items.id), eq(items.userId, userId))!;
