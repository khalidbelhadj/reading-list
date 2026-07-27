// YouTube engine: official embed iframe driven over the widget postMessage
// protocol (no external API script — keeps CSP self-contained). Focused
// watching: player + the extracted transcript, no youtube.com chrome.
import React from "react";

import {
  createViewerEmitter,
  useRegisterViewerSession,
  type ViewerSession,
  type ViewerState,
} from "@/lib/viewer/session";

const EMBED_ORIGIN = "https://www.youtube-nocookie.com";

type PlayerInfo = { currentTime: number; duration: number; paused: boolean };

// Transcript paragraphs in the extracted markdown are prefixed "**[mm:ss]**".
const transcriptAround = (
  markdown: string | null,
  currentTime: number,
): string => {
  if (!markdown) return "";
  const paragraphs = markdown.split("\n\n");
  const withTime = paragraphs.flatMap((paragraph) => {
    const match = paragraph.match(/^\*\*\[(\d+):(\d\d)\]\*\*/);
    if (!match) return [];
    const seconds = Number(match[1]) * 60 + Number(match[2]);
    return [{ seconds, paragraph }];
  });
  if (withTime.length === 0) return "";
  return withTime
    .filter((entry) => Math.abs(entry.seconds - currentTime) <= 90)
    .map((entry) => entry.paragraph)
    .join("\n\n");
};

export const YouTubeEngine = ({
  itemId,
  url,
  title,
  videoId,
  markdown,
}: {
  itemId: string;
  url: string;
  title: string;
  videoId: string;
  markdown: string | null;
}) => {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const infoRef = React.useRef<PlayerInfo>({
    currentTime: 0,
    duration: 0,
    paused: true,
  });

  // Widget protocol: announce "listening", then YouTube streams infoDelivery
  // messages (currentTime, duration, playerState) our way.
  React.useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const listen = () => {
      iframe.contentWindow?.postMessage(
        JSON.stringify({ event: "listening", id: videoId }),
        EMBED_ORIGIN,
      );
    };
    const interval = setInterval(listen, 500);

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== EMBED_ORIGIN) return;
      if (event.source !== iframe.contentWindow) return;
      if (typeof event.data !== "string") return;
      try {
        const data = JSON.parse(event.data) as {
          event?: string;
          info?: {
            currentTime?: number;
            duration?: number;
            playerState?: number;
          };
        };
        if (data.event === "onReady" || data.event === "infoDelivery") {
          clearInterval(interval);
        }
        if (data.info) {
          infoRef.current = {
            currentTime: data.info.currentTime ?? infoRef.current.currentTime,
            duration: data.info.duration ?? infoRef.current.duration,
            // playerState 1 = playing.
            paused:
              data.info.playerState !== undefined
                ? data.info.playerState !== 1
                : infoRef.current.paused,
          };
        }
      } catch {
        // Non-JSON frames are not ours.
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      clearInterval(interval);
      window.removeEventListener("message", onMessage);
    };
  }, [videoId]);

  const session = React.useMemo<ViewerSession>(() => {
    const emitter = createViewerEmitter();
    const getState = async (): Promise<ViewerState> => ({
      kind: "youtube",
      url,
      title,
      media: { ...infoRef.current },
      selection: null,
    });
    return {
      kind: "youtube",
      itemId,
      getState,
      getVisibleText: async () =>
        transcriptAround(markdown, infoRef.current.currentTime),
      getSelection: async () => null,
      on: emitter.on,
    };
  }, [itemId, url, title, markdown]);

  useRegisterViewerSession(session);

  const transcript = React.useMemo(() => {
    if (!markdown) return null;
    const index = markdown.indexOf("## Transcript");
    return index === -1 ? null : markdown.slice(index + "## Transcript".length);
  }, [markdown]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 pt-6 pb-24">
      <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
        <iframe
          ref={iframeRef}
          className="h-full w-full"
          src={`${EMBED_ORIGIN}/embed/${videoId}?enablejsapi=1`}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
      {transcript && (
        <div className="mx-auto w-full max-w-2xl">
          <p className="mb-3 font-content text-sm text-muted-foreground">
            Transcript
          </p>
          <div className="reader-content text-[0.95rem] whitespace-pre-wrap">
            {transcript.trim()}
          </div>
        </div>
      )}
    </div>
  );
};
