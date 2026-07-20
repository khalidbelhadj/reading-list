// DOM-selection → ViewerSelection helper for engines that own their DOM
// (reader view). The prefix/suffix context comes from the rendered text
// around the selection, capped so payloads stay small.
//
// Mirrored in electron/viewer-preload.ts (describeSelection) — keep the
// algorithm in sync. The preload build's rootDir (electron/) can't reach
// lib/, so the two copies can't share a module; the preload copy roots the
// context at document.body and skips the container check.
import { type ViewerSelection } from "./session";

const CONTEXT_CHARS = 200;

export const describeSelection = (
  container: HTMLElement,
): ViewerSelection | null => {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }
  const range = selection.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return null;

  const text = selection.toString().trim();
  if (!text) return null;

  const before = document.createRange();
  before.selectNodeContents(container);
  before.setEnd(range.startContainer, range.startOffset);
  const after = document.createRange();
  after.selectNodeContents(container);
  after.setStart(range.endContainer, range.endOffset);

  return {
    text,
    prefix: before.toString().slice(-CONTEXT_CHARS),
    suffix: after.toString().slice(0, CONTEXT_CHARS),
  };
};
