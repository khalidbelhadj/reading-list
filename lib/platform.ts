// Platform gating — the one source of truth for "are we running inside the
// desktop shell?". electron/preload.ts exposes `window.readingList` over the
// context bridge before any app script runs, so this is a plain synchronous
// read: no effect, no false-then-true flash on first render, and the answer
// never changes for the life of the document.
//
//   isElectron()     imperative code — handlers, effects, plain modules
//   useIsElectron()  render-time gating inside a component
//   <ElectronOnly>   gating a whole subtree or page (components/electron-only)
//
// CSS gates on `html.electron` instead (also set by the preload) — see the
// electron-top-bar-inset block in app/globals.css.
import { useSyncExternalStore } from "react";

export const isElectron = (): boolean =>
  typeof window !== "undefined" && window.readingList?.platform === "electron";

// Nothing to subscribe to: the platform can't change under a running document.
const subscribe = () => () => {};
// SSR always renders the web shell. useSyncExternalStore re-reads the client
// snapshot right after hydration and re-renders if it differs, so components
// get the real value without a mismatch — and without an effect.
const getServerSnapshot = () => false;

export const useIsElectron = (): boolean =>
  useSyncExternalStore(subscribe, isElectron, getServerSnapshot);
