import { lookupItem, saveItem, itemUrl, getAppUrl } from "./api.js";

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

const openCurrentItem = async () => {
  if (!ctx.item) return;
  await chrome.tabs.create({ url: itemUrl(ctx.appUrl, ctx.item.id) });
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

const doSave = async () => {
  setState("saving");
  setAction(`${ICON.spinner}<span>Save to reading list</span>`, {
    disabled: true,
  });
  try {
    const result = await saveItem({
      url: ctx.tab.url,
      title: ctx.tab.title,
      faviconUrl: ctx.tab.favIconUrl,
    });
    ctx.item = result.ok ? { id: result.itemId } : result.duplicate;
    renderSaved({ justSaved: true });
  } catch (err) {
    handleFailure(err);
  }
};

const init = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  ctx.tab = tab;
  ctx.appUrl = await getAppUrl();

  const savable = tab && /^https?:/.test(tab.url || "");
  if (!savable) {
    titleEl.textContent = tab?.title || "No page";
    hostEl.textContent = tab?.url ? hostOf(tab.url) : "";
    setFavicon(tab?.favIconUrl);
    renderUnsavable();
    return;
  }

  // optimistic identity from the tab while we check the server
  titleEl.textContent = tab.title || hostOf(tab.url);
  hostEl.textContent = hostOf(tab.url);
  setFavicon(tab.favIconUrl);

  try {
    const { item, appUrl } = await lookupItem(tab.url);
    ctx.appUrl = appUrl;
    if (item) {
      ctx.item = item;
      if (item.title) titleEl.textContent = item.title;
      setFavicon(item.faviconUrl || tab.favIconUrl);
      renderSaved();
    } else {
      renderUnsaved();
    }
  } catch (err) {
    handleFailure(err);
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
