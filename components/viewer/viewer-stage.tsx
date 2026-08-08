// The reading stage: picks and mounts the right engine for an item, shared
// by the in-page ReadingPanel and the standalone /read/$itemId page. The
// engines register ViewerSessions; the surrounding chrome (header, notes)
// belongs to the host.
import { useQuery } from "@tanstack/react-query";
import type React from "react";

import { getItemContent } from "@/app/actions";
import { Spinner } from "@/components/ui/spinner";
import { classifyUrl, type ContentKind } from "@/lib/extract/classify";
import { useIsElectron } from "@/lib/platform";
import { type Item } from "@/lib/types";
import { getYouTubeVideoId } from "@/lib/url";

import { IframeEngine } from "./iframe-engine";
import { PdfEngine } from "./pdf-engine";
import { WebviewEngine } from "./webview-engine";
import { YouTubeEngine } from "./youtube-engine";

export const openExternally = (url: string) => {
  if (window.readingList) {
    void window.readingList.openExternal(url);
  } else {
    window.open(url, "_blank", "noopener");
  }
};

// Per-item view state the stage needs (title for the engines' sessions, kind
// for engine selection). Lives here so hosts just hand the stage an item.
const useViewerContent = (item: Item) => {
  const { data: content, isLoading } = useQuery({
    queryKey: ["item-content", item.id],
    queryFn: () => getItemContent(item.id),
    // The indexer may still be working right after a save — poll gently until
    // the row settles.
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      return state === "pending" || state === "running" ? 4000 : false;
    },
  });

  const kind: ContentKind = classifyUrl(item.url);
  // Text is shown as soon as it exists, whether or not the embed step has
  // finished — the reader does not care about the vector.
  const markdown = content?.markdown ?? null;
  const title = item.title || content?.title || item.url;
  return { content, contentLoading: isLoading, kind, markdown, title };
};

export const ViewerStage = ({ item }: { item: Item }) => {
  const { content, contentLoading, kind, markdown, title } =
    useViewerContent(item);

  if (contentLoading && !content) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  // Document engines flow in the stage's scroll; pane engines fill it.
  let engine: React.ReactNode;
  let paneEngine = false;
  if (kind === "youtube") {
    const videoId = getYouTubeVideoId(item.url);
    engine = videoId ? (
      <YouTubeEngine
        itemId={item.id}
        url={item.url}
        title={title}
        videoId={videoId}
        markdown={markdown}
      />
    ) : null;
  } else if (kind === "pdf" || kind === "arxiv") {
    paneEngine = true;
    engine = (
      <PdfEngine
        itemId={item.id}
        url={item.url}
        title={title}
        markdown={markdown}
      />
    );
  } else {
    // The mini browser: the item's actual page. Electron gets a real webview
    // (renders everything, feeds live capture); the web app gets an iframe
    // attempt (renders sites that allow embedding).
    paneEngine = true;
    engine = <LiveWebEngine item={item} title={title} markdown={markdown} />;
  }

  return (
    <div
      data-viewer-stage
      className={
        paneEngine
          ? "relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
          : "relative min-h-0 min-w-0 flex-1 overflow-y-auto"
      }
    >
      {engine}
    </div>
  );
};

const LiveWebEngine = ({
  item,
  title,
  markdown,
}: {
  item: Item;
  title: string;
  markdown: string | null;
}) => {
  const isElectron = useIsElectron();
  return isElectron ? (
    <WebviewEngine itemId={item.id} url={item.url} title={title} />
  ) : (
    <IframeEngine
      itemId={item.id}
      url={item.url}
      title={title}
      markdown={markdown}
    />
  );
};
