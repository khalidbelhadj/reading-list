import type { MutationPayload } from "./types";
import {
  createItem,
  updateItem,
  deleteItem,
  reorderItem,
  toggleRead,
  bulkDeleteItems,
  bulkMoveItems,
  bulkTag,
  bulkMarkRead,
  importBookmarks,
} from "@/app/actions";

export async function executeMutation(payload: MutationPayload): Promise<void> {
  switch (payload.kind) {
    case "create":
      await createItem(
        payload.title,
        payload.url,
        payload.tagNames,
        payload.faviconUrl,
        payload.type,
        payload.notes,
        payload.id,
      );
      break;
    case "update":
      await updateItem(payload.id, payload.fields);
      break;
    case "delete":
      await deleteItem(payload.id);
      break;
    case "reorder":
      await reorderItem(payload.id, payload.type, payload.newPosition);
      break;
    case "toggleRead":
      await toggleRead(payload.id, payload.read);
      break;
    case "bulkDelete":
      await bulkDeleteItems(payload.ids);
      break;
    case "bulkMove":
      await bulkMoveItems(payload.ids, payload.newType);
      break;
    case "bulkTag":
      await bulkTag(payload.ids, payload.tagNames);
      break;
    case "bulkMarkRead":
      await bulkMarkRead(payload.ids, payload.read);
      break;
    case "importBookmarks":
      await importBookmarks(payload.html);
      break;
  }
}
