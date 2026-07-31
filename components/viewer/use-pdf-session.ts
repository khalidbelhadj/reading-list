// The PDF engine's ViewerSession — the contract everything outside
// components/viewer/ uses to observe a reading session (page, visible text,
// selection) and to drive the viewer programmatically.
//
// Kept out of the engine component because it must be *identity-stable*: the
// session is registered in a module-level registry, so re-creating it on every
// zoom tick would churn the registry sixty times a second. Everything that
// changes frequently is read through refs instead.
import React from "react";

import { describeSelection } from "@/lib/viewer/selection";
import {
  createViewerEmitter,
  useRegisterViewerSession,
  type ViewerSession,
  type ViewerState,
} from "@/lib/viewer/session";

import { type PdfZoom } from "./use-pdf-viewer";

export const usePdfSession = ({
  itemId,
  url,
  title,
  markdown,
  container,
  pageTextsRef,
  currentPage,
  pageCount,
  zoom,
  pageWindow,
  goToPage,
  setZoom,
}: {
  itemId: string;
  url: string;
  title: string;
  markdown: string | null;
  container: HTMLDivElement | null;
  pageTextsRef: React.RefObject<Map<number, string>>;
  currentPage: number;
  pageCount: number;
  zoom: PdfZoom;
  pageWindow: { start: number; end: number };
  goToPage: (page: number) => void;
  setZoom: (zoom: PdfZoom) => void;
}) => {
  const liveRef = React.useRef({
    container,
    currentPage,
    pageCount,
    zoom,
    pageWindow,
    goToPage,
    setZoom,
  });
  liveRef.current = {
    container,
    currentPage,
    pageCount,
    zoom,
    pageWindow,
    goToPage,
    setZoom,
  };

  const emitterRef = React.useRef(createViewerEmitter());

  const session = React.useMemo<ViewerSession>(
    () => ({
      kind: "pdf",
      itemId,
      pdf: {
        state: () => {
          const live = liveRef.current;
          return {
            page: live.currentPage,
            pageCount: live.pageCount,
            scale: live.zoom.mode === "custom" ? live.zoom.value : "fit",
          };
        },
        goToPage: (page: number) => liveRef.current.goToPage(page),
        setScale: (next: number | "fit") =>
          liveRef.current.setZoom(
            next === "fit"
              ? { mode: "fit-width", value: 1 }
              : { mode: "custom", value: next },
          ),
      },
      getState: async (): Promise<ViewerState> => ({
        kind: "pdf",
        url,
        title,
        page: {
          current: liveRef.current.currentPage,
          total: liveRef.current.pageCount,
        },
        selection: liveRef.current.container
          ? describeSelection(liveRef.current.container)
          : null,
      }),
      // Text of the pages currently in view — real visible-context now that
      // the text layer is ours (the built-in viewer was a black box). Falls
      // back to extracted markdown before the text layer has rendered.
      getVisibleText: async () => {
        const { pageWindow: live } = liveRef.current;
        const texts: string[] = [];
        for (let page = live.start + 1; page <= live.end + 1; page += 1) {
          const text = pageTextsRef.current.get(page);
          if (text) texts.push(text);
        }
        if (texts.length > 0) return texts.join("\n\n").slice(0, 8000);
        return markdown?.slice(0, 4000) ?? "";
      },
      getSelection: async () =>
        liveRef.current.container
          ? describeSelection(liveRef.current.container)
          : null,
      on: emitterRef.current.on,
    }),
    [itemId, url, title, markdown, pageTextsRef],
  );

  useRegisterViewerSession(session);
};
