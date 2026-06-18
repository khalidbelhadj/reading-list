import { saveItem, itemUrl } from "./api.js";

const MENU_PAGE = "save-page";
const MENU_LINK = "save-link";

// Map a notification id -> the app URL to open when the user clicks it.
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

const notify = (title, message, openUrl) => {
  chrome.notifications.create(
    {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon-128.png"),
      title,
      message,
      ...(openUrl ? { buttons: [{ title: "Open in reading list" }] } : {}),
    },
    (id) => {
      if (openUrl && id) pendingOpens.set(id, openUrl);
    },
  );
};

const openFromNotification = (notificationId) => {
  const url = pendingOpens.get(notificationId);
  if (url) {
    chrome.tabs.create({ url });
    pendingOpens.delete(notificationId);
    chrome.notifications.clear(notificationId);
  }
};

chrome.notifications.onClicked.addListener(openFromNotification);
chrome.notifications.onButtonClicked.addListener(openFromNotification);

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const payload =
    info.menuItemId === MENU_LINK
      ? { url: info.linkUrl } // title fetched server-side
      : {
          url: info.pageUrl || tab?.url,
          title: tab?.title,
          faviconUrl: tab?.favIconUrl,
        };

  if (!payload.url || !/^https?:/.test(payload.url)) {
    notify("Can't save that", "Only http(s) links can be saved.");
    return;
  }

  try {
    const result = await saveItem(payload);
    if (result.ok) {
      notify(
        "Saved to reading list",
        payload.title || payload.url,
        itemUrl(result.appUrl, result.itemId),
      );
    } else {
      notify(
        "Already in your reading list",
        result.duplicate?.title || payload.url,
        itemUrl(result.appUrl, result.duplicate.id),
      );
    }
  } catch (err) {
    if (err?.code === "auth") {
      notify("Not signed in", "Open the app and sign in, then try again.");
    } else if (err?.code === "network") {
      notify("Couldn't reach the app", `Check the URL in Settings (${err.appUrl}).`);
    } else {
      notify("Save failed", "Something went wrong saving the item.");
    }
  }
});
