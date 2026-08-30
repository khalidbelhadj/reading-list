// "Which reading-list items are open in a browser tab right now?"
//
// electron/browser-tabs.ts pushes the tab set over IPC; this module keeps it in
// a module-level store and exposes two reads:
//
//   useOpenTabItems(items)  the matching items, for the Open-in-browser section
//   useOpenTab(url)         one item's tab, for the "Go to tab" menu item
//
// The store subscribes lazily: the bridge is attached when the first component
// subscribes and torn down when the last unsubscribes, which is also what
// starts and stops the poll in the main process. The `showOpenTabs` setting is
// applied *here*, so turning it off means no listener, no IPC and no osascript
// — not a hidden UI. On web (and non-macOS) nothing ever arrives.
import React from "react";

import { type BrowserTab, type BrowserTabRef } from "@/electron/channels";
import { isElectron } from "@/lib/platform";
import { type Item } from "@/lib/types";
import { urlMatchKey } from "@/lib/url";
import { useSettings } from "@/lib/use-settings";

export type OpenTab = {
  /** Frontmost tab of its window — "you're looking at this". */
  active: boolean;
  /** Display name of the owning browser, e.g. "Chrome". */
  browser: string;
  ref: BrowserTabRef;
};

type TabIndex = ReadonlyMap<string, OpenTab>;

const EMPTY: TabIndex = new Map();

let snapshot: TabIndex = EMPTY;
const listeners = new Set<() => void>();
let detach: (() => void) | null = null;

// Keyed by urlMatchKey so an item and its tab match through tracking params,
// www., trailing slashes and YouTube's many URL shapes.
const indexTabs = (tabs: BrowserTab[]): TabIndex => {
  const next = new Map<string, OpenTab>();
  for (const tab of tabs) {
    const key = urlMatchKey(tab.url);
    if (!key) continue;
    // The same page can be open in several tabs. An active one wins, so both
    // the ordering and "Go to tab" land on the one you're actually looking at.
    if (next.get(key)?.active) continue;
    next.set(key, {
      active: tab.active,
      browser: tab.browser,
      ref: { app: tab.app, tabId: tab.tabId },
    });
  }
  return next;
};

// A tab counts as "this item, open" when it is the same page OR sits under
// the item's URL — a deeper subpath (`item/…`) or the same page with extra
// query params (`item?…`, `item&…`). Exact matches win; among prefix matches
// an active tab wins. YouTube keys (`youtube:<id>`) only ever match exactly.
const findTab = (tabs: TabIndex, itemKey: string): OpenTab | null => {
  const exact = tabs.get(itemKey);
  if (exact) return exact;
  if (itemKey.startsWith("youtube:")) return null;
  let found: OpenTab | null = null;
  for (const [tabKey, tab] of tabs) {
    if (
      tabKey.startsWith(itemKey) &&
      ["/", "?", "&"].includes(tabKey[itemKey.length] ?? "")
    ) {
      if (tab.active) return tab;
      found ??= tab;
    }
  }
  return found;
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  if (listeners.size === 1 && isElectron()) {
    detach =
      window.readingList?.onBrowserTabs((tabs) => {
        snapshot = indexTabs(tabs);
        for (const each of listeners) each();
      }) ?? null;
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    detach?.();
    detach = null;
    // Nothing is listening, so nothing can observe this — but leaving a stale
    // map behind would flash last session's tabs on the next subscribe.
    snapshot = EMPTY;
  };
};

const getSnapshot = () => snapshot;
// SSR renders the web shell, which never has tabs. Doubles as the "feature is
// switched off" snapshot.
const getEmptySnapshot = () => EMPTY;
const noopSubscribe = () => () => {};

const useTabIndex = (): TabIndex => {
  const { settings } = useSettings();
  const enabled = settings.showOpenTabs;
  return React.useSyncExternalStore(
    enabled ? subscribe : noopSubscribe,
    enabled ? getSnapshot : getEmptySnapshot,
    getEmptySnapshot,
  );
};

/**
 * The items currently open in a browser tab, the ones you're actively viewing
 * first. Order within each group follows the list order that was passed in.
 */
export const useOpenTabItems = (items: Item[] | undefined): Item[] => {
  const tabs = useTabIndex();
  return React.useMemo(() => {
    if (!items || tabs.size === 0) return [];
    const matched: { item: Item; active: boolean }[] = [];
    for (const item of items) {
      const key = item.url ? urlMatchKey(item.url) : null;
      const tab = key ? findTab(tabs, key) : null;
      if (tab) matched.push({ item, active: tab.active });
    }
    return matched
      .sort((a, b) => Number(b.active) - Number(a.active))
      .map((entry) => entry.item);
  }, [items, tabs]);
};

/** The tab this item is open in, or null. */
export const useOpenTab = (url: string | null): OpenTab | null => {
  const tabs = useTabIndex();
  if (!url || tabs.size === 0) return null;
  const key = urlMatchKey(url);
  return key ? findTab(tabs, key) : null;
};

/** Raise a browser tab and bring its browser to the front. */
export const focusBrowserTab = (ref: BrowserTabRef) => {
  if (!isElectron()) return;
  void window.readingList?.focusBrowserTab(ref);
};
