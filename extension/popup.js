import {
  getAppUrl,
  lookupItem,
  openItem,
  readCache,
  writeCache,
} from "./api.js";

const card = document.getElementById("card");
const faviconEl = document.getElementById("favicon");
const titleEl = document.getElementById("title");
const hostEl = document.getElementById("host");
const actionEl = document.getElementById("action");
const settingsEl = document.getElementById("settings");

// --- icons (tabler, stroke) ---
const svg = (paths) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
const ICON = {
  bookmark: svg(
    `<path d="M18 7v14l-6 -4l-6 4v-14a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4z" />`,
  ),
  check: `<svg class="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5l9.5 -10.5" /></svg>`,
  arrow: svg(`<path d="M5 12h14" /><path d="M13 6l6 6l-6 6" />`),
  spinner: `<span class="spinner"></span>`,
};

// app-wide state
const ctx = {
  tab: null,
  appUrl: "http://localhost:3000",
  item: null, // saved item, if any
};

const setState = (name) => {
  card.className = `state-${name}`;
};

const setAction = (html, { variant = "primary", disabled = false } = {}) => {
  actionEl.className = `action ${variant}`;
  actionEl.innerHTML = html;
  actionEl.disabled = disabled;
};

const setFavicon = (url) => {
  if (url && /^https?:|^data:/.test(url)) {
    card.classList.remove("no-favicon");
    faviconEl.src = url;
    faviconEl.onerror = () => card.classList.add("no-favicon");
  } else {
    card.classList.add("no-favicon");
  }
};

const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

// In-flight optimistic save, if any. "Open in reading list" waits on it,
// because the item id only exists once the worker's write comes back.
let pendingSave = null;

const openCurrentItem = async () => {
  if (pendingSave) await pendingSave;
  if (!ctx.item) return;
  await openItem(ctx.appUrl, ctx.item.id);
  window.close();
};

// --- render the contextual states ---
const renderUnsaved = () => {
  setState("unsaved");
  setAction(`${ICON.bookmark}<span>Save to reading list</span>`, {
    variant: "primary",
  });
  actionEl.onclick = doSave;
};

const renderSaved = ({ justSaved = false } = {}) => {
  setState(justSaved ? "just-saved" : "saved");
  setAction(`${ICON.check}<span>Open in reading list</span>${ICON.arrow}`, {
    variant: "outline",
  });
  actionEl.onclick = openCurrentItem;
};

const renderUnsavable = () => {
  setState("unsavable");
  titleEl.textContent = "This page can’t be saved";
  hostEl.textContent = "";
};

const handleFailure = () => {
  setState("error");
  titleEl.textContent = "Couldn’t reach your reading list";
  hostEl.textContent = "";
  setAction("Go to settings", { variant: "outline" });
  actionEl.onclick = () => chrome.runtime.openOptionsPage();
};

// Optimistic: flip to the saved state on the click and hand the write to the
// service worker, which outlives this popup. The old version awaited the POST
// with the popup held open, so every save cost a full round trip of staring at
// a spinner. A failed write notifies from the background instead.
const doSave = () => {
  ctx.item = null;
  pendingSave = chrome.runtime
    .sendMessage({
      type: "save",
      tabId: ctx.tab.id,
      payload: {
        url: ctx.tab.url,
        title: ctx.tab.title,
        faviconUrl: ctx.tab.favIconUrl,
      },
    })
    .then((result) => {
      if (result?.ok) ctx.item = result.item;
    })
    .catch(() => {
      // The worker notifies on failure; the popup is likely gone by now.
    });
  renderSaved({ justSaved: true });
};

const showItem = (item, tab) => {
  ctx.item = item;
  if (item) {
    if (item.title) titleEl.textContent = item.title;
    setFavicon(item.faviconUrl || tab.favIconUrl);
    renderSaved();
  } else {
    renderUnsaved();
  }
};

const init = async () => {
  // Independent reads — the old sequential await chain delayed the first paint
  // by a storage round trip for no reason.
  const [[tab], appUrl] = await Promise.all([
    chrome.tabs.query({ active: true, currentWindow: true }),
    getAppUrl(),
  ]);
  ctx.tab = tab;
  ctx.appUrl = appUrl;

  const savable = tab && /^https?:/.test(tab.url || "");
  if (!savable) {
    titleEl.textContent = tab?.title || "No page";
    hostEl.textContent = tab?.url ? hostOf(tab.url) : "";
    setFavicon(tab?.favIconUrl);
    renderUnsavable();
    return;
  }

  // Identity from the tab itself — always available, never waits.
  titleEl.textContent = tab.title || hostOf(tab.url);
  hostEl.textContent = hostOf(tab.url);
  setFavicon(tab.favIconUrl);

  // Render a usable button on the first frame: the background worker has
  // usually already looked this url up on tab activation. Falling back to
  // "unsaved" is the safe guess — worst case the revalidation below corrects
  // it, and saving an already-saved url is a no-op the server dedupes.
  const cached = await readCache(tab.url);
  showItem(cached?.item ?? null, tab);

  // Revalidate regardless; a cache hit just means the user never saw a spinner.
  try {
    const { item, appUrl: resolvedUrl } = await lookupItem(tab.url);
    ctx.appUrl = resolvedUrl;
    await writeCache(tab.url, item);
    // Don't stomp an optimistic save that landed while this was in flight.
    if (!pendingSave) showItem(item, tab);
  } catch (err) {
    // A stale cache hit is more useful than an error card; only report the
    // failure when we had nothing to show in the first place.
    if (!cached) handleFailure(err);
  }
};

// Enter triggers the primary action
document.addEventListener("keydown", (e) => {
  if (
    e.key === "Enter" &&
    !actionEl.disabled &&
    card.classList.contains("state-unsaved")
  ) {
    actionEl.click();
  }
});

settingsEl.addEventListener("click", () => chrome.runtime.openOptionsPage());

init();
