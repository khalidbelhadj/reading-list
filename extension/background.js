import {
  isFresh,
  lookupItem,
  openItem,
  readCache,
  saveItem,
  writeCache,
} from "./api.js";

const MENU_PAGE = "save-page";
const MENU_LINK = "save-link";
const SAVE_COMMAND = "save-current-page";

// Map a notification id -> { appUrl, itemId } to open when the user clicks it.
// Resolved to a web or app URL at click time per the user's "open in" setting.
const pendingOpens = new Map();

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_PAGE,
    title: "Save this page to reading list",
    contexts: ["page"],
  });
  chrome.contextMenus.create({
    id: MENU_LINK,
    title: "Save link to reading list",
    contexts: ["link"],
  });
});

const notify = (title, message, open) => {
  chrome.notifications.create(
    {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon-128.png"),
      title,
      message,
      ...(open ? { buttons: [{ title: "Open in reading list" }] } : {}),
    },
    (id) => {
      if (open && id) pendingOpens.set(id, open);
    },
  );
};

const openFromNotification = (notificationId) => {
  const open = pendingOpens.get(notificationId);
  if (open) {
    void openItem(open.appUrl, open.itemId);
    pendingOpens.delete(notificationId);
    chrome.notifications.clear(notificationId);
  }
};

chrome.notifications.onClicked.addListener(openFromNotification);
chrome.notifications.onButtonClicked.addListener(openFromNotification);

// --- saved-state badge -----------------------------------------------------
// A tick on the toolbar icon means "this page is already in your list", so the
// common question is answered without opening the popup at all.
const setBadge = (tabId, isSaved) => {
  if (tabId === undefined) return;
  // Both calls reject if the tab closed while a lookup was in flight, which is
  // routine — swallow it rather than litter the worker with rejections.
  chrome.action
    .setBadgeText({ tabId, text: isSaved ? "✓" : "" })
    .catch(() => {});
  if (isSaved) {
    chrome.action
      .setBadgeBackgroundColor({ tabId, color: "#3f6212" })
      .catch(() => {});
  }
};

const isSavable = (url) => !!url && /^https?:/.test(url);

// Paint the badge from cache, then revalidate against the server and cache the
// answer so the popup can render instantly. Network failures leave whatever
// the cache said — a stale tick beats a spinner.
const refreshTabState = async (tabId, url) => {
  if (!isSavable(url)) {
    setBadge(tabId, false);
    return;
  }

  const cached = await readCache(url);
  if (cached) {
    setBadge(tabId, !!cached.item);
    // A recent answer is good enough; don't spend a request per tab switch.
    if (isFresh(cached)) return;
  }

  try {
    const { item } = await lookupItem(url);
    await writeCache(url, item);
    setBadge(tabId, !!item);
  } catch {
    // Signed out or offline; the popup surfaces the real error when opened.
  }
};

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    void refreshTabState(tabId, tab.url);
  } catch {
    // Tab vanished between the event and the lookup.
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // onUpdated fires for every loading tick; only a committed url change or a
  // finished load can alter the answer.
  if (changeInfo.url || changeInfo.status === "complete") {
    void refreshTabState(tabId, tab.url);
  }
});

// --- saving ----------------------------------------------------------------
// One path for every entry point (popup, context menu, keyboard shortcut), so
// the cache and badge stay correct however the item got saved.
const performSave = async (payload, { tabId, silent = false } = {}) => {
  if (!isSavable(payload.url)) {
    if (!silent) notify("Can't save that", "Only http(s) links can be saved.");
    return { ok: false };
  }

  try {
    const result = await saveItem(payload);
    const item = result.ok
      ? { id: result.itemId, title: result.title }
      : result.duplicate;
    await writeCache(payload.url, item);
    setBadge(tabId, true);

    if (!silent) {
      notify(
        result.ok ? "Saved to reading list" : "Already in your reading list",
        item?.title || payload.title || payload.url,
        { appUrl: result.appUrl, itemId: item.id },
      );
    }
    return { ok: true, item };
  } catch (err) {
    // The popup may already have shown an optimistic tick, so a failure always
    // notifies — it's the only signal the user gets that the save didn't land.
    if (err?.code === "auth") {
      notify("Not signed in", "Open the app and sign in, then try again.");
    } else if (err?.code === "network") {
      notify(
        "Couldn't reach the app",
        `Check the URL in Settings (${err.appUrl}).`,
      );
    } else {
      notify("Save failed", "Something went wrong saving the item.");
    }
    return { ok: false };
  }
};

// The popup hands the write here and closes; the service worker outlives it,
// so the request completes either way.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "save") return undefined;
  performSave(message.payload, { tabId: message.tabId, silent: true }).then(
    sendResponse,
    () => sendResponse({ ok: false }),
  );
  return true; // keep the channel open for the async response
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const payload =
    info.menuItemId === MENU_LINK
      ? { url: info.linkUrl } // title fetched server-side
      : {
          url: info.pageUrl || tab?.url,
          title: tab?.title,
          faviconUrl: tab?.favIconUrl,
        };
  // A link save lands on some other page, so only badge the tab when we saved
  // the tab's own url.
  await performSave(payload, {
    tabId: info.menuItemId === MENU_LINK ? undefined : tab?.id,
  });
});

// Save without opening the popup at all — the fastest path there is.
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== SAVE_COMMAND) return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  await performSave(
    { url: tab.url, title: tab.title, faviconUrl: tab.favIconUrl },
    { tabId: tab.id },
  );
});
