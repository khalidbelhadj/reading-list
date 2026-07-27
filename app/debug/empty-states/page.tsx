import {
  type Icon as TablerIcon,
  IconAlertCircle,
  IconAlertTriangle,
  IconArchive,
  IconBan,
  IconBookmark,
  IconBox,
  IconCircleOff,
  IconCloudOff,
  IconFileText,
  IconFolderOpen,
  IconGhost,
  IconInbox,
  IconInfoCircle,
  IconMoodEmpty,
  IconPlugConnectedX,
  IconRefresh,
  IconSearch,
  IconSearchOff,
  IconWifiOff,
} from "@tabler/icons-react";
import React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type ToneKey = "empty" | "warning" | "error";
type Align = "left" | "center" | "right";

const ALIGN: Record<Align, { items: string; text: string }> = {
  left: { items: "items-start", text: "text-left" },
  center: { items: "items-center", text: "text-center" },
  right: { items: "items-end", text: "text-right" },
};

const ALIGN_KEYS: Align[] = ["left", "center", "right"];
const ALIGN_LABEL: Record<Align, string> = {
  left: "Left",
  center: "Center",
  right: "Right",
};

type ToneMeta = {
  label: string;
  // Inline color values (oklch / token vars) so the three tones read distinctly
  // without inventing new global tokens for a sandbox.
  color: string;
  tint: string;
  defaultIcon: TablerIcon;
};

const TONES: Record<ToneKey, ToneMeta> = {
  empty: {
    label: "Empty",
    color: "var(--muted-foreground)",
    tint: "var(--muted)",
    defaultIcon: IconInbox,
  },
  warning: {
    label: "Warning",
    color: "oklch(0.70 0.15 75)",
    tint: "oklch(0.70 0.15 75 / 0.12)",
    defaultIcon: IconAlertTriangle,
  },
  error: {
    label: "Error",
    color: "var(--destructive)",
    tint: "oklch(0.6 0.22 27 / 0.12)",
    defaultIcon: IconAlertCircle,
  },
};

const TONE_KEYS: ToneKey[] = ["empty", "warning", "error"];

const ICONS: { id: string; Icon: TablerIcon }[] = [
  { id: "inbox", Icon: IconInbox },
  { id: "search", Icon: IconSearch },
  { id: "search-off", Icon: IconSearchOff },
  { id: "mood-empty", Icon: IconMoodEmpty },
  { id: "ghost", Icon: IconGhost },
  { id: "circle-off", Icon: IconCircleOff },
  { id: "ban", Icon: IconBan },
  { id: "alert-triangle", Icon: IconAlertTriangle },
  { id: "alert-circle", Icon: IconAlertCircle },
  { id: "info-circle", Icon: IconInfoCircle },
  { id: "cloud-off", Icon: IconCloudOff },
  { id: "wifi-off", Icon: IconWifiOff },
  { id: "plug-off", Icon: IconPlugConnectedX },
  { id: "archive", Icon: IconArchive },
  { id: "box", Icon: IconBox },
  { id: "folder", Icon: IconFolderOpen },
  { id: "bookmark", Icon: IconBookmark },
  { id: "file", Icon: IconFileText },
  { id: "refresh", Icon: IconRefresh },
];

type Cfg = {
  toneKey: ToneKey;
  tone: ToneMeta;
  align: Align;
  Icon: TablerIcon;
  showIcon: boolean;
  title: string;
  description: string;
  showDescription: boolean;
  showPrimary: boolean;
  primaryLabel: string;
  showSecondary: boolean;
  secondaryLabel: string;
};

// ---- Shared building blocks -------------------------------------------------

// A vertical stack that honors the active alignment for both cross-axis
// position (items-*) and text wrapping (text-*). `group` is the same minus the
// text class, for nested title/description clusters.
const stack = (cfg: Cfg, extra: string) =>
  cn("flex flex-col", ALIGN[cfg.align].items, ALIGN[cfg.align].text, extra);
const group = (cfg: Cfg, extra: string) =>
  cn("flex flex-col", ALIGN[cfg.align].items, extra);

const Title = ({ cfg, className }: { cfg: Cfg; className?: string }) => (
  <p className={cn("font-content text-foreground", className)}>
    {cfg.title || "Untitled"}
  </p>
);

const Description = ({ cfg, className }: { cfg: Cfg; className?: string }) =>
  cfg.showDescription && cfg.description ? (
    <p className={cn("text-xs text-muted-foreground", className)}>
      {cfg.description}
    </p>
  ) : null;

const Actions = ({ cfg, className }: { cfg: Cfg; className?: string }) => {
  if (!cfg.showPrimary && !cfg.showSecondary) return null;
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {cfg.showPrimary && (
        <Button
          size="sm"
          variant={cfg.toneKey === "error" ? "destructive" : "default"}
        >
          {cfg.primaryLabel || "Action"}
        </Button>
      )}
      {cfg.showSecondary && (
        <Button size="sm" variant="ghost">
          {cfg.secondaryLabel || "Learn more"}
        </Button>
      )}
    </div>
  );
};

const CircleIcon = ({ cfg, size }: { cfg: Cfg; size: number }) => (
  <div
    className="flex items-center justify-center rounded-full"
    style={{ background: cfg.tone.tint, width: size, height: size }}
  >
    <cfg.Icon
      style={{ color: cfg.tone.color, width: size / 2, height: size / 2 }}
    />
  </div>
);

// ---- Style variants ---------------------------------------------------------

type StyleDef = {
  id: string;
  name: string;
  description: string;
  render: (cfg: Cfg) => React.ReactNode;
};

const STYLES: StyleDef[] = [
  {
    id: "centered",
    name: "Centered",
    description: "Icon in soft circle, stacked",
    render: (cfg) => (
      <div className={stack(cfg, "justify-center gap-3 py-10")}>
        {cfg.showIcon && <CircleIcon cfg={cfg} size={48} />}
        <div className={group(cfg, "gap-1")}>
          <Title cfg={cfg} className="text-base" />
          <Description cfg={cfg} className="max-w-xs" />
        </div>
        <Actions cfg={cfg} className="mt-1" />
      </div>
    ),
  },
  {
    id: "centered-plain",
    name: "Plain icon",
    description: "No circle, tighter",
    render: (cfg) => (
      <div className={stack(cfg, "justify-center gap-2 py-10")}>
        {cfg.showIcon && (
          <cfg.Icon className="size-7" style={{ color: cfg.tone.color }} />
        )}
        <Title cfg={cfg} className="text-sm" />
        <Description cfg={cfg} className="max-w-xs" />
        <Actions cfg={cfg} className="mt-2" />
      </div>
    ),
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Text only, faint",
    render: (cfg) => (
      <div className={stack(cfg, "justify-center gap-1.5 py-12")}>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {cfg.showIcon && (
            <cfg.Icon className="size-4" style={{ color: cfg.tone.color }} />
          )}
          <span className="text-sm">{cfg.title || "Untitled"}</span>
        </div>
        {cfg.showDescription && cfg.description && (
          <p className="max-w-xs text-xs text-muted-foreground/70">
            {cfg.description}
          </p>
        )}
        <Actions cfg={cfg} className="mt-2" />
      </div>
    ),
  },
  {
    id: "status-message",
    name: "Status message",
    description: "Text only, red on error (no icon)",
    render: (cfg) => {
      // Title and description share one normal size; the description is faint.
      // On error both turn red and the action becomes destructive — otherwise
      // the action is an outline button. This style never shows an icon.
      const isError = cfg.toneKey === "error";
      return (
        <div className={stack(cfg, "justify-center gap-1 py-12")}>
          <p
            className={cn(
              "font-content text-sm",
              isError ? "text-destructive" : "text-foreground",
            )}
          >
            {cfg.title || "Untitled"}
          </p>
          {cfg.showDescription && cfg.description && (
            <p
              className={cn(
                "max-w-xs text-sm",
                isError ? "text-destructive/70" : "text-muted-foreground",
              )}
            >
              {cfg.description}
            </p>
          )}
          {(cfg.showPrimary || cfg.showSecondary) && (
            <div className="mt-3 flex items-center gap-2">
              {cfg.showPrimary && (
                <Button size="sm" variant={isError ? "destructive" : "outline"}>
                  {cfg.primaryLabel || "Action"}
                </Button>
              )}
              {cfg.showSecondary && (
                <Button size="sm" variant="ghost">
                  {cfg.secondaryLabel || "Learn more"}
                </Button>
              )}
            </div>
          )}
        </div>
      );
    },
  },
  {
    id: "card",
    name: "Card",
    description: "On bg-card, rounded",
    render: (cfg) => (
      <div className={stack(cfg, "w-full gap-3 rounded-lg bg-card px-6 py-10")}>
        {cfg.showIcon && <CircleIcon cfg={cfg} size={48} />}
        <div className={group(cfg, "gap-1")}>
          <Title cfg={cfg} className="text-base" />
          <Description cfg={cfg} className="max-w-xs" />
        </div>
        <Actions cfg={cfg} className="mt-1" />
      </div>
    ),
  },
  {
    id: "dashed",
    name: "Dashed placeholder",
    description: "Drop-zone feel",
    render: (cfg) => (
      <div
        className={stack(
          cfg,
          "w-full gap-3 rounded-lg border border-dashed border-border px-6 py-10",
        )}
      >
        {cfg.showIcon && (
          <cfg.Icon className="size-7" style={{ color: cfg.tone.color }} />
        )}
        <div className={group(cfg, "gap-1")}>
          <Title cfg={cfg} className="text-sm" />
          <Description cfg={cfg} className="max-w-xs" />
        </div>
        <Actions cfg={cfg} className="mt-1" />
      </div>
    ),
  },
  {
    id: "banner",
    name: "Banner",
    description: "Horizontal, tinted (fixed)",
    render: (cfg) => (
      <div
        className="flex w-full items-center gap-3 rounded-lg px-4 py-3"
        style={{ background: cfg.tone.tint }}
      >
        {cfg.showIcon && (
          <cfg.Icon
            className="size-5 shrink-0"
            style={{ color: cfg.tone.color }}
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="truncate text-sm font-medium text-foreground">
            {cfg.title || "Untitled"}
          </p>
          {cfg.showDescription && cfg.description && (
            <p className="text-xs text-muted-foreground">{cfg.description}</p>
          )}
        </div>
        <Actions cfg={cfg} className="shrink-0" />
      </div>
    ),
  },
  {
    id: "inline-left",
    name: "Inline, left-aligned",
    description: "Icon left, text right (fixed)",
    render: (cfg) => (
      <div className="flex w-full items-start gap-3 py-6">
        {cfg.showIcon && <CircleIcon cfg={cfg} size={40} />}
        <div className="flex flex-col items-start gap-1">
          <Title cfg={cfg} className="text-sm" />
          <Description cfg={cfg} className="max-w-xs" />
          <Actions cfg={cfg} className="mt-1" />
        </div>
      </div>
    ),
  },
  {
    id: "icon-tile",
    name: "Icon tile",
    description: "Large rounded tile",
    render: (cfg) => (
      <div className={stack(cfg, "justify-center gap-3 py-10")}>
        {cfg.showIcon && (
          <div
            className="flex items-center justify-center rounded-2xl"
            style={{ background: cfg.tone.tint, width: 64, height: 64 }}
          >
            <cfg.Icon className="size-7" style={{ color: cfg.tone.color }} />
          </div>
        )}
        <div className={group(cfg, "gap-1")}>
          <Title cfg={cfg} className="text-base" />
          <Description cfg={cfg} className="max-w-xs" />
        </div>
        <Actions cfg={cfg} className="mt-1" />
      </div>
    ),
  },
];

// ---- Controls ---------------------------------------------------------------

const Toggle = ({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) => (
  <label className="flex items-center gap-2 text-xs text-muted-foreground select-none">
    <Switch size="sm" checked={checked} onCheckedChange={onChange} />
    <span>{label}</span>
  </label>
);

const Field = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col gap-1">
    <span className="text-[11px] font-medium tracking-wide text-muted-foreground/70 uppercase">
      {label}
    </span>
    {children}
  </div>
);

const EmptyStatesPlayground = () => {
  const [toneKey, setToneKey] = React.useState<ToneKey>("empty");
  const [align, setAlign] = React.useState<Align>("center");
  const [iconId, setIconId] = React.useState<string>("auto");
  const [title, setTitle] = React.useState("No items yet");
  const [description, setDescription] = React.useState(
    "Save articles, papers, and links to read later, and they'll show up here.",
  );
  const [showIcon, setShowIcon] = React.useState(true);
  const [showDescription, setShowDescription] = React.useState(true);
  const [showPrimary, setShowPrimary] = React.useState(true);
  const [primaryLabel, setPrimaryLabel] = React.useState("Add item");
  const [showSecondary, setShowSecondary] = React.useState(false);
  const [secondaryLabel, setSecondaryLabel] = React.useState("Learn more");

  const tone = TONES[toneKey];
  const Icon =
    iconId === "auto"
      ? tone.defaultIcon
      : (ICONS.find((entry) => entry.id === iconId)?.Icon ?? tone.defaultIcon);

  const cfg: Cfg = {
    toneKey,
    tone,
    align,
    Icon,
    showIcon,
    title,
    description,
    showDescription,
    showPrimary,
    primaryLabel,
    showSecondary,
    secondaryLabel,
  };

  return (
    <div className="min-h-dvh px-5 py-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-content text-xl">Empty &amp; nonideal states</h1>
          <p className="text-sm text-muted-foreground">
            Tune the content and toggles, then compare every style at once.
            Empty, warning, and error tones; icons, descriptions, and actions
            all optional.
          </p>
        </div>

        {/* Controls */}
        <div className="sticky top-0 z-10 -mx-5 flex flex-col gap-4 bg-background/95 px-5 py-4 backdrop-blur">
          <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
            <Field label="Tone">
              <div className="flex gap-1">
                {TONE_KEYS.map((key) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={toneKey === key ? "secondary" : "ghost"}
                    onClick={() => setToneKey(key)}
                  >
                    {TONES[key].label}
                  </Button>
                ))}
              </div>
            </Field>

            <Field label="Alignment">
              <div className="flex gap-1">
                {ALIGN_KEYS.map((key) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={align === key ? "secondary" : "ghost"}
                    onClick={() => setAlign(key)}
                  >
                    {ALIGN_LABEL[key]}
                  </Button>
                ))}
              </div>
            </Field>

            <Field label="Title">
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Title"
                className="w-56"
              />
            </Field>

            <Field label="Description">
              <Input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Description"
                className="w-80"
              />
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Toggle label="Icon" checked={showIcon} onChange={setShowIcon} />
            <Toggle
              label="Description"
              checked={showDescription}
              onChange={setShowDescription}
            />
            <div className="flex items-center gap-2">
              <Toggle
                label="Primary action"
                checked={showPrimary}
                onChange={setShowPrimary}
              />
              {showPrimary && (
                <Input
                  value={primaryLabel}
                  onChange={(event) => setPrimaryLabel(event.target.value)}
                  placeholder="Label"
                  className="w-28"
                />
              )}
            </div>
            <div className="flex items-center gap-2">
              <Toggle
                label="Secondary action"
                checked={showSecondary}
                onChange={setShowSecondary}
              />
              {showSecondary && (
                <Input
                  value={secondaryLabel}
                  onChange={(event) => setSecondaryLabel(event.target.value)}
                  placeholder="Label"
                  className="w-28"
                />
              )}
            </div>
          </div>

          <Field label="Icon">
            <div
              className={cn(
                "flex flex-wrap gap-1",
                !showIcon && "pointer-events-none opacity-40",
              )}
            >
              <button
                type="button"
                onClick={() => setIconId("auto")}
                className={cn(
                  "flex h-8 items-center rounded-md px-2 text-xs",
                  iconId === "auto"
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                Auto
              </button>
              {ICONS.map(({ id, Icon: Option }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setIconId(id)}
                  className={cn(
                    "flex size-8 items-center justify-center rounded-md",
                    iconId === id
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <Option className="size-4" />
                </button>
              ))}
            </div>
          </Field>
        </div>

        {/* Gallery */}
        <div className="grid grid-cols-1 gap-x-6 gap-y-8 md:grid-cols-2">
          {STYLES.map((style) => (
            <div key={style.id} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-4">
                <span className="font-content text-sm text-foreground">
                  {style.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {style.description}
                </span>
              </div>
              <div className="flex min-h-[220px] items-center justify-center rounded-lg bg-muted/40 px-4">
                <div className="w-full max-w-sm">{style.render(cfg)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const EmptyStatesPage = () => {
  return <EmptyStatesPlayground />;
};

export default EmptyStatesPage;
