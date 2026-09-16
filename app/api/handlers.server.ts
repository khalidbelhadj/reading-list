// The server side of lib/api/contract.ts: one handler per route, each a thin
// call into the implementations in app/actions/*. Auth is resolved inside
// those (getCurrentUserId reads the cookie session or the bearer token), so
// every client shares one code path for url normalisation, the duplicate
// check, title fetching and the notes-to-flashcards sync.
import { getAllFlashcards, updateFlashcard } from "@/app/actions/flashcards";
import { reindexItem, semanticSearch } from "@/app/actions/index-content";
import {
  createItem,
  deleteItem,
  fetchPageTitle,
  generateItemPreview,
  searchItems,
  setItemRead,
  updateItem,
} from "@/app/actions/items";
import { fetchItemPreviews, fetchItems } from "@/app/actions/queries";
import { rateCard } from "@/app/actions/review";
import { getSettings, updateSettings } from "@/app/actions/settings";
import { getVersionInfo } from "@/app/actions/version";
import { requestImageUpload } from "@/app/actions-storage.server";
import {
  type Input,
  type Output,
  type Params,
  type RouteKey,
} from "@/lib/api/contract";

type HandlerContext<K extends RouteKey> = {
  params: Params<K>;
  input: Input<K>;
  request: Request;
};

export type Handlers = {
  [K in RouteKey]: (context: HandlerContext<K>) => Promise<Output<K>>;
};

export const handlers: Handlers = {
  listItems: () => fetchItems(),

  createItem: async ({ input }) => {
    const url = input.url ?? "";
    let title = input.title?.trim() ?? "";
    if (!title && url)
      title = ((await fetchPageTitle(url)) ?? url).slice(0, 500);
    const result = await createItem(
      title,
      url,
      input.faviconUrl,
      input.notes,
      input.id,
      input.allowDuplicateUrl,
    );
    return result.ok ? { ...result, title } : result;
  },

  searchItems: ({ input }) => searchItems(input.query),

  listItemPreviews: () => fetchItemPreviews(),

  updateItem: async ({ params, input }) => {
    const { refreshTitle, ...fields } = input;
    // A new url can bring the page's title along, while the caller says the
    // item's own title is still a placeholder.
    if (refreshTitle && fields.url) {
      const fetched = (await fetchPageTitle(fields.url))?.trim();
      if (fetched) fields.title = fetched.slice(0, 500);
    }
    await updateItem(params.id, fields);
    return { title: fields.title ?? null };
  },

  deleteItem: async ({ params }) => {
    await deleteItem(params.id);
    return { ok: true };
  },

  setItemRead: async ({ params, input }) => {
    await setItemRead(params.id, input.read);
    return { ok: true };
  },

  generateItemPreview: async ({ params }) => ({
    previewImageUrl: await generateItemPreview(params.id),
  }),

  reindexItem: async ({ params }) => {
    await reindexItem({ itemId: params.id });
    return { ok: true };
  },

  fetchPageTitle: async ({ input }) => ({
    title: await fetchPageTitle(input.url),
  }),

  listFlashcards: () => getAllFlashcards(),

  updateFlashcard: async ({ params, input }) => {
    await updateFlashcard(params.id, input);
    return { ok: true };
  },

  rateCard: async ({ params, input }) => {
    await rateCard({ flashcardId: params.id, ...input });
    return { ok: true };
  },

  semanticSearch: ({ input }) => semanticSearch(input),

  getSettings: () => getSettings(),

  updateSettings: async ({ input }) => {
    await updateSettings(input);
    return { ok: true };
  },

  requestImageUpload: ({ input }) => requestImageUpload(input),

  getVersion: () => getVersionInfo(),
};
