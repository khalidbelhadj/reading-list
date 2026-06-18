"use client";

import React from "react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { IconFileFilled, IconSparkles } from "@tabler/icons-react";

import { Switch } from "@/components/ui/switch";
import { getFaviconSrc } from "@/components/items-list/utils";
import { getYouTubeVideoId } from "@/lib/url";
import { cn } from "@/lib/utils";

// ---- Mock data --------------------------------------------------------------

type Suggestion = {
  id: string;
  title: string;
  url: string;
  faviconUrl: string | null;
  // Non-YouTube preview image (YouTube thumbnails are derived from the URL).
  previewImageUrl: string | null;
  read?: boolean;
};

const MOCK: Suggestion[] = [
  {
    id: "1",
    title: "Typst: Designing for Incrementality (Laurenz Mädje at RustWeek)",
    url: "https://www.youtube.com/watch?v=yWWVhbyOWWE",
    faviconUrl: null,
    previewImageUrl: null,
  },
  {
    id: "2",
    title: "Attention Is All You Need",
    url: "https://arxiv.org/abs/1706.03762",
    faviconUrl: null,
    previewImageUrl: "https://picsum.photos/seed/attention/480/270",
  },
  {
    id: "3",
    title: "tailwindlabs/tailwindcss: A utility-first CSS framework",
    url: "https://github.com/tailwindlabs/tailwindcss",
    faviconUrl: null,
    previewImageUrl: "https://picsum.photos/seed/tailwind/480/270",
  },
  {
    id: "4",
    title: "The Absurdly Underestimated Dangers of CSV Injection",
    url: "https://georgemauer.net/2017/10/07/csv-injection.html",
    faviconUrl: null,
    previewImageUrl: "https://picsum.photos/seed/csv/480/270",
  },
  {
    id: "5",
    title: "PSY - GANGNAM STYLE(강남스타일) M/V",
    url: "https://www.youtube.com/watch?v=9bZkp7q19f0",
    faviconUrl: null,
    previewImageUrl: null,
  },
  {
    id: "6",
    title: "Designing Data-Intensive Applications — chapter notes",
    url: "https://stripe.com/blog/online-migrations",
    faviconUrl: null,
    previewImageUrl: "https://picsum.photos/seed/ddia/480/270",
  },
  {
    id: "7",
    title: "A Philosophy of Software Design (already read)",
    url: "https://web.stanford.edu/~ouster/cgi-bin/book.php",
    faviconUrl: null,
    previewImageUrl: "https://picsum.photos/seed/philosophy/480/270",
    read: true,
  },
];

const getYouTubeThumb = (url: string): string | null => {
  const ytId = getYouTubeVideoId(url);
  return ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : null;
};

const getPreviewSrc = (item: Suggestion): string | null =>
  getYouTubeThumb(item.url) ?? item.previewImageUrl;

const getDomain = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

// ---- Card pieces ------------------------------------------------------------

type CardCfg = { showDomain: boolean; dimRead: boolean };

const Preview = ({
  item,
  className,
}: {
  item: Suggestion;
  className?: string;
}) => {
  const src = getPreviewSrc(item);
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-muted ring-1 ring-foreground/5",
        className,
      )}
    >
      {src ? (
        <Image
          src={src}
          alt=""
          fill
          sizes="320px"
          className="object-cover"
          unoptimized
        />
      ) : (
        <div className="flex size-full items-center justify-center">
          <IconFileFilled className="size-5 text-muted-foreground/50" />
        </div>
      )}
    </div>
  );
};

const Favicon = ({
  item,
  className,
}: {
  item: Suggestion;
  className?: string;
}) => {
  const src = getFaviconSrc(item);
  return src ? (
    <Image
      src={src}
      alt=""
      width={16}
      height={16}
      className={cn("size-4 shrink-0 rounded-xs", className)}
      unoptimized
    />
  ) : (
    <IconFileFilled
      className={cn("size-4 shrink-0 text-muted-foreground", className)}
    />
  );
};

// ---- Style variants ---------------------------------------------------------

type StyleDef = {
  id: string;
  name: string;
  description: string;
  // Per-style horizontal item size; the strip scrolls if they overflow.
  render: (item: Suggestion, cfg: CardCfg) => React.ReactNode;
};

const STYLES: StyleDef[] = [
  {
    id: "cozy",
    name: "Cozy",
    description: "16:9 preview, favicon + title below, domain footer",
    render: (item, cfg) => (
      <div
        className={cn(
          "flex w-44 shrink-0 cursor-pointer flex-col gap-2",
          cfg.dimRead && item.read && "opacity-50",
        )}
      >
        <Preview item={item} className="aspect-video w-full rounded-md" />
        <div className="flex flex-col gap-0.5">
          <div className="flex items-start gap-1.5">
            <Favicon item={item} className="mt-px size-3.5" />
            <span className="line-clamp-2 font-content text-sm/4.5 text-foreground">
              {item.title}
            </span>
          </div>
          {cfg.showDomain && (
            <span className="pl-5.5 text-xs text-muted-foreground/60">
              {getDomain(item.url)}
            </span>
          )}
        </div>
      </div>
    ),
  },
  {
    id: "compact",
    name: "Compact",
    description: "Narrower, tight one-glance grid",
    render: (item, cfg) => (
      <div
        className={cn(
          "flex w-32 shrink-0 cursor-pointer flex-col gap-1.5",
          cfg.dimRead && item.read && "opacity-50",
        )}
      >
        <Preview item={item} className="aspect-video w-full rounded" />
        <div className="flex items-start gap-1">
          <Favicon item={item} className="mt-px size-3" />
          <span className="line-clamp-2 font-content text-xs/4 text-foreground">
            {item.title}
          </span>
        </div>
      </div>
    ),
  },
  {
    id: "card",
    name: "Card surface",
    description: "On bg-card, padded, rounded-lg",
    render: (item, cfg) => (
      <div
        className={cn(
          "flex w-48 shrink-0 cursor-pointer flex-col gap-2 rounded-lg bg-card p-2 transition-colors hover:bg-foreground/5",
          cfg.dimRead && item.read && "opacity-50",
        )}
      >
        <Preview item={item} className="aspect-video w-full rounded-md" />
        <div className="flex flex-col gap-1 px-0.5 pb-0.5">
          <span className="line-clamp-2 font-content text-sm/4.5 text-foreground">
            {item.title}
          </span>
          <div className="flex items-center gap-1.5">
            <Favicon item={item} className="size-3.5" />
            {cfg.showDomain && (
              <span className="truncate text-xs text-muted-foreground/60">
                {getDomain(item.url)}
              </span>
            )}
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "overlay",
    name: "Favicon overlay",
    description: "Favicon badge on the preview, title below",
    render: (item, cfg) => (
      <div
        className={cn(
          "flex w-44 shrink-0 cursor-pointer flex-col gap-2",
          cfg.dimRead && item.read && "opacity-50",
        )}
      >
        <div className="relative">
          <Preview item={item} className="aspect-video w-full rounded-md" />
          <div className="absolute bottom-1 left-1 flex size-5 items-center justify-center rounded-[4px] bg-background/90 ring-1 ring-foreground/10 backdrop-blur">
            <Favicon item={item} className="size-3.5" />
          </div>
        </div>
        <span className="line-clamp-2 font-content text-sm/4.5 text-foreground">
          {item.title}
        </span>
      </div>
    ),
  },
  {
    id: "poster",
    name: "Poster",
    description: "Taller 3:4, gradient title overlay",
    render: (item, cfg) => (
      <div
        className={cn(
          "relative aspect-3/4 w-40 shrink-0 cursor-pointer overflow-hidden rounded-lg",
          cfg.dimRead && item.read && "opacity-50",
        )}
      >
        <Preview item={item} className="absolute inset-0" />
        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 via-black/40 to-transparent p-2.5 pt-8">
          <div className="flex items-start gap-1.5">
            <Favicon item={item} className="mt-px size-3.5" />
            <span className="line-clamp-3 font-content text-sm/4.5 text-white">
              {item.title}
            </span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Preview only, single-line title",
    render: (item, cfg) => (
      <div
        className={cn(
          "flex w-36 shrink-0 cursor-pointer flex-col gap-1.5",
          cfg.dimRead && item.read && "opacity-50",
        )}
      >
        <Preview item={item} className="aspect-video w-full rounded-md" />
        <div className="flex items-center gap-1.5">
          <Favicon item={item} className="size-3" />
          <span className="truncate font-content text-xs text-muted-foreground">
            {item.title}
          </span>
        </div>
      </div>
    ),
  },
];

// ---- Page -------------------------------------------------------------------

const Toggle = ({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) => (
  <label className="flex select-none items-center gap-2 text-xs text-muted-foreground">
    <Switch size="sm" checked={checked} onCheckedChange={onChange} />
    <span>{label}</span>
  </label>
);

const SuggestedCardsPlayground = () => {
  const [showDomain, setShowDomain] = React.useState(true);
  const [dimRead, setDimRead] = React.useState(true);

  const cfg: CardCfg = { showDomain, dimRead };

  return (
    <div className="min-h-dvh px-5 py-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-content text-xl">Suggested cards</h1>
          <p className="text-sm text-muted-foreground">
            Horizontal preview-card styles for the &ldquo;Suggested&rdquo;
            strip. Each row scrolls horizontally — compare the variants and pick
            one.
          </p>
        </div>

        {/* Controls */}
        <div className="sticky top-0 z-10 -mx-5 flex flex-wrap items-center gap-x-6 gap-y-3 bg-background/95 px-5 py-4 backdrop-blur">
          <Toggle label="Domain" checked={showDomain} onChange={setShowDomain} />
          <Toggle label="Dim read" checked={dimRead} onChange={setDimRead} />
        </div>

        {/* Gallery */}
        <div className="flex flex-col gap-10">
          {STYLES.map((style) => (
            <div key={style.id} className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-4">
                <div className="flex items-center gap-1.5">
                  <IconSparkles className="size-3.5 text-muted-foreground" />
                  <span className="font-content text-sm text-foreground">
                    {style.name}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {style.description}
                </span>
              </div>
              <div className="-mx-5 overflow-x-auto px-5">
                <div className="flex gap-4 pb-2">
                  {MOCK.map((item) => (
                    <React.Fragment key={item.id}>
                      {style.render(item, cfg)}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const SuggestedCardsPage = () => {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }
  return <SuggestedCardsPlayground />;
};

export default SuggestedCardsPage;
