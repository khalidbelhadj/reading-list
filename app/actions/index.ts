import { createServerFn } from "@tanstack/react-start";

import type * as flashcardsImpl from "./flashcards";
import type * as itemsImpl from "./items";
import type * as reviewsImpl from "./reviews";
import type * as settingsImpl from "./settings";
import type * as tagsImpl from "./tags";

// RPC layer between client code and the server-only implementations. Each
// exported function keeps the exact signature of its implementation (callers
// are unchanged from the Next.js server-action days); the createServerFn
// handlers dynamically import the impl modules so db/pdf/etc. code never
// reaches the client bundle. Thrown ActionError/UnauthorizedError messages
// serialize across the wire, so mutation error toasts behave as before.

export type {
  BatchedReviewEvent,
  FlashcardWithItem,
  ItemReviewStatus,
  ReviewMode,
  ReviewScope,
  ReviewSessionCard,
  ReviewSessionData,
  SessionSummary,
} from "./reviews";

// --- items ---

const searchItemsFn = createServerFn({ method: "POST" })
  .validator((args: Parameters<typeof itemsImpl.searchItems>) => args)
  .handler(({ data }) => import("./items").then((m) => m.searchItems(...data)));
export const searchItems: typeof itemsImpl.searchItems = (...args) =>
  searchItemsFn({ data: args });

const searchFlashcardsFn = createServerFn({ method: "POST" })
  .validator((args: Parameters<typeof itemsImpl.searchFlashcards>) => args)
  .handler(({ data }) =>
    import("./items").then((m) => m.searchFlashcards(...data)),
  );
export const searchFlashcards: typeof itemsImpl.searchFlashcards = (...args) =>
  searchFlashcardsFn({ data: args });

const deleteItemFn = createServerFn({ method: "POST" })
  .validator((args: Parameters<typeof itemsImpl.deleteItem>) => args)
  .handler(({ data }) => import("./items").then((m) => m.deleteItem(...data)));
export const deleteItem: typeof itemsImpl.deleteItem = (...args) =>
  deleteItemFn({ data: args });

const fetchPageTitleFn = createServerFn({ method: "POST" })
  .validator((args: Parameters<typeof itemsImpl.fetchPageTitle>) => args)
  .handler(({ data }) =>
    import("./items").then((m) => m.fetchPageTitle(...data)),
  );
export const fetchPageTitle: typeof itemsImpl.fetchPageTitle = (...args) =>
  fetchPageTitleFn({ data: args });

const createItemFn = createServerFn({ method: "POST" })
  .validator((args: Parameters<typeof itemsImpl.createItem>) => args)
  .handler(({ data }) => import("./items").then((m) => m.createItem(...data)));
export const createItem: typeof itemsImpl.createItem = (...args) =>
  createItemFn({ data: args });

const updateItemFn = createServerFn({ method: "POST" })
  .validator((args: Parameters<typeof itemsImpl.updateItem>) => args)
  .handler(({ data }) => import("./items").then((m) => m.updateItem(...data)));
export const updateItem: typeof itemsImpl.updateItem = (...args) =>
  updateItemFn({ data: args });

const toggleReadFn = createServerFn({ method: "POST" })
  .validator((args: Parameters<typeof itemsImpl.toggleRead>) => args)
  .handler(({ data }) => import("./items").then((m) => m.toggleRead(...data)));
export const toggleRead: typeof itemsImpl.toggleRead = (...args) =>
  toggleReadFn({ data: args });

const bulkDeleteItemsFn = createServerFn({ method: "POST" })
  .validator((args: Parameters<typeof itemsImpl.bulkDeleteItems>) => args)
  .handler(({ data }) =>
    import("./items").then((m) => m.bulkDeleteItems(...data)),
  );
export const bulkDeleteItems: typeof itemsImpl.bulkDeleteItems = (...args) =>
  bulkDeleteItemsFn({ data: args });

const bulkTagFn = createServerFn({ method: "POST" })
  .validator((args: Parameters<typeof itemsImpl.bulkTag>) => args)
  .handler(({ data }) => import("./items").then((m) => m.bulkTag(...data)));
export const bulkTag: typeof itemsImpl.bulkTag = (...args) =>
  bulkTagFn({ data: args });

const bulkMarkReadFn = createServerFn({ method: "POST" })
  .validator((args: Parameters<typeof itemsImpl.bulkMarkRead>) => args)
  .handler(({ data }) =>
    import("./items").then((m) => m.bulkMarkRead(...data)),
  );
export const bulkMarkRead: typeof itemsImpl.bulkMarkRead = (...args) =>
  bulkMarkReadFn({ data: args });

const bulkSetPinnedFn = createServerFn({ method: "POST" })
  .validator((args: Parameters<typeof itemsImpl.bulkSetPinned>) => args)
  .handler(({ data }) =>
    import("./items").then((m) => m.bulkSetPinned(...data)),
  );
export const bulkSetPinned: typeof itemsImpl.bulkSetPinned = (...args) =>
  bulkSetPinnedFn({ data: args });

const generateItemPreviewFn = createServerFn({ method: "POST" })
  .validator((args: Parameters<typeof itemsImpl.generateItemPreview>) => args)
  .handler(({ data }) =>
    import("./items").then((m) => m.generateItemPreview(...data)),
  );
export const generateItemPreview: typeof itemsImpl.generateItemPreview = (
  ...args
) => generateItemPreviewFn({ data: args });

// --- tags ---

const renameTagFn = createServerFn({ method: "POST" })
  .validator((args: Parameters<typeof tagsImpl.renameTag>) => args)
  .handler(({ data }) => import("./tags").then((m) => m.renameTag(...data)));
export const renameTag: typeof tagsImpl.renameTag = (...args) =>
  renameTagFn({ data: args });

const deleteTagFn = createServerFn({ method: "POST" })
  .validator((args: Parameters<typeof tagsImpl.deleteTag>) => args)
  .handler(({ data }) => import("./tags").then((m) => m.deleteTag(...data)));
export const deleteTag: typeof tagsImpl.deleteTag = (...args) =>
  deleteTagFn({ data: args });

// --- settings ---

const getSettingsFn = createServerFn({ method: "POST" }).handler(() =>
  import("./settings").then((m) => m.getSettings()),
);
export const getSettings: typeof settingsImpl.getSettings = () =>
  getSettingsFn();

const updateSettingsFn = createServerFn({ method: "POST" })
  .validator((args: Parameters<typeof settingsImpl.updateSettings>) => args)
  .handler(({ data }) =>
    import("./settings").then((m) => m.updateSettings(...data)),
  );
export const updateSettings: typeof settingsImpl.updateSettings = (...args) =>
  updateSettingsFn({ data: args });

// --- flashcards ---

const getFlashcardsFn = createServerFn({ method: "POST" })
  .validator((args: Parameters<typeof flashcardsImpl.getFlashcards>) => args)
  .handler(({ data }) =>
    import("./flashcards").then((m) => m.getFlashcards(...data)),
  );
export const getFlashcards: typeof flashcardsImpl.getFlashcards = (...args) =>
  getFlashcardsFn({ data: args });

const getAllFlashcardsFn = createServerFn({ method: "POST" }).handler(() =>
  import("./flashcards").then((m) => m.getAllFlashcards()),
);
export const getAllFlashcards: typeof flashcardsImpl.getAllFlashcards = () =>
  getAllFlashcardsFn();

const createFlashcardFn = createServerFn({ method: "POST" })
  .validator((args: Parameters<typeof flashcardsImpl.createFlashcard>) => args)
  .handler(({ data }) =>
    import("./flashcards").then((m) => m.createFlashcard(...data)),
  );
export const createFlashcard: typeof flashcardsImpl.createFlashcard = (
  ...args
) => createFlashcardFn({ data: args });

const updateFlashcardFn = createServerFn({ method: "POST" })
  .validator((args: Parameters<typeof flashcardsImpl.updateFlashcard>) => args)
  .handler(({ data }) =>
    import("./flashcards").then((m) => m.updateFlashcard(...data)),
  );
export const updateFlashcard: typeof flashcardsImpl.updateFlashcard = (
  ...args
) => updateFlashcardFn({ data: args });

const deleteFlashcardFn = createServerFn({ method: "POST" })
  .validator((args: Parameters<typeof flashcardsImpl.deleteFlashcard>) => args)
  .handler(({ data }) =>
    import("./flashcards").then((m) => m.deleteFlashcard(...data)),
  );
export const deleteFlashcard: typeof flashcardsImpl.deleteFlashcard = (
  ...args
) => deleteFlashcardFn({ data: args });

// --- reviews ---

const getDueCardsFn = createServerFn({ method: "POST" })
  // Optional-tuple params lose their tuple-ness over the wire (JSON arrays
  // have no fixed arity), so accept the widened array and narrow it back.
  .validator(
    (args: Array<number | undefined>) =>
      args as Parameters<typeof reviewsImpl.getDueCards>,
  )
  .handler(({ data }) =>
    import("./reviews").then((m) => m.getDueCards(...data)),
  );
export const getDueCards: typeof reviewsImpl.getDueCards = (...args) =>
  getDueCardsFn({ data: args });

const getNewCardsFn = createServerFn({ method: "POST" })
  .validator(
    (args: Array<number | undefined>) =>
      args as Parameters<typeof reviewsImpl.getNewCards>,
  )
  .handler(({ data }) =>
    import("./reviews").then((m) => m.getNewCards(...data)),
  );
export const getNewCards: typeof reviewsImpl.getNewCards = (...args) =>
  getNewCardsFn({ data: args });

const getCardsForItemFn = createServerFn({ method: "POST" })
  .validator((args: Parameters<typeof reviewsImpl.getCardsForItem>) => args)
  .handler(({ data }) =>
    import("./reviews").then((m) => m.getCardsForItem(...data)),
  );
export const getCardsForItem: typeof reviewsImpl.getCardsForItem = (...args) =>
  getCardsForItemFn({ data: args });

const getAllCardsForCramFn = createServerFn({ method: "POST" }).handler(() =>
  import("./reviews").then((m) => m.getAllCardsForCram()),
);
export const getAllCardsForCram: typeof reviewsImpl.getAllCardsForCram = () =>
  getAllCardsForCramFn();

const startReviewSessionFn = createServerFn({ method: "POST" })
  .validator((args: Parameters<typeof reviewsImpl.startReviewSession>) => args)
  .handler(({ data }) =>
    import("./reviews").then((m) => m.startReviewSession(...data)),
  );
export const startReviewSession: typeof reviewsImpl.startReviewSession = (
  ...args
) => startReviewSessionFn({ data: args });

const getReviewSessionFn = createServerFn({ method: "POST" })
  .validator((args: Parameters<typeof reviewsImpl.getReviewSession>) => args)
  .handler(({ data }) =>
    import("./reviews").then((m) => m.getReviewSession(...data)),
  );
export const getReviewSession: typeof reviewsImpl.getReviewSession = (
  ...args
) => getReviewSessionFn({ data: args });

const getSessionSummaryFn = createServerFn({ method: "POST" })
  .validator((args: Parameters<typeof reviewsImpl.getSessionSummary>) => args)
  .handler(({ data }) =>
    import("./reviews").then((m) => m.getSessionSummary(...data)),
  );
export const getSessionSummary: typeof reviewsImpl.getSessionSummary = (
  ...args
) => getSessionSummaryFn({ data: args });

const rateCardFn = createServerFn({ method: "POST" })
  .validator((args: Parameters<typeof reviewsImpl.rateCard>) => args)
  .handler(({ data }) => import("./reviews").then((m) => m.rateCard(...data)));
export const rateCard: typeof reviewsImpl.rateCard = (...args) =>
  rateCardFn({ data: args });

const logSessionEventFn = createServerFn({ method: "POST" })
  .validator((args: Parameters<typeof reviewsImpl.logSessionEvent>) => args)
  .handler(({ data }) =>
    import("./reviews").then((m) => m.logSessionEvent(...data)),
  );
export const logSessionEvent: typeof reviewsImpl.logSessionEvent = (...args) =>
  logSessionEventFn({ data: args });

const skipCardFn = createServerFn({ method: "POST" })
  .validator((args: Parameters<typeof reviewsImpl.skipCard>) => args)
  .handler(({ data }) => import("./reviews").then((m) => m.skipCard(...data)));
export const skipCard: typeof reviewsImpl.skipCard = (...args) =>
  skipCardFn({ data: args });

const endReviewSessionFn = createServerFn({ method: "POST" })
  .validator((args: Parameters<typeof reviewsImpl.endReviewSession>) => args)
  .handler(({ data }) =>
    import("./reviews").then((m) => m.endReviewSession(...data)),
  );
export const endReviewSession: typeof reviewsImpl.endReviewSession = (
  ...args
) => endReviewSessionFn({ data: args });

const getReviewStatusFn = createServerFn({ method: "POST" }).handler(() =>
  import("./reviews").then((m) => m.getReviewStatus()),
);
export const getReviewStatus: typeof reviewsImpl.getReviewStatus = () =>
  getReviewStatusFn();

const getItemReviewStatusFn = createServerFn({ method: "POST" })
  .validator((args: Parameters<typeof reviewsImpl.getItemReviewStatus>) => args)
  .handler(({ data }) =>
    import("./reviews").then((m) => m.getItemReviewStatus(...data)),
  );
export const getItemReviewStatus: typeof reviewsImpl.getItemReviewStatus = (
  ...args
) => getItemReviewStatusFn({ data: args });
