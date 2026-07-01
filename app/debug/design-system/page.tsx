"use client";

import { notFound } from "next/navigation";
import React from "react";
import {
  IconAdjustments,
  IconArchive,
  IconArrowRight,
  IconBolt,
  IconBookmark,
  IconCheck,
  IconChevronDown,
  IconCircle,
  IconClipboard,
  IconCopy,
  IconDots,
  IconDownload,
  IconExternalLink,
  IconEye,
  IconEyeOff,
  IconFileFilled,
  IconFilter,
  IconHeart,
  IconHelp,
  IconHome,
  IconInfoCircle,
  IconLink,
  IconMoon,
  IconPencil,
  IconPinFilled,
  IconPlus,
  IconSearch,
  IconSettings,
  IconShare,
  IconSparkles,
  IconStar,
  IconSun,
  IconTrash,
  IconUser,
  IconX,
} from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuSwitchItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

// ─── color tokens ────────────────────────────────────────────────────────────

const colorTokens = [
  { name: "background", desc: "page background" },
  { name: "foreground", desc: "default text" },
  { name: "card", desc: "elevated surfaces" },
  { name: "card-foreground", desc: "text on cards" },
  { name: "popover", desc: "menus, dropdowns" },
  { name: "popover-foreground", desc: "text in popovers" },
  { name: "primary", desc: "brand / default buttons" },
  { name: "primary-foreground", desc: "text on primary" },
  { name: "primary-border", desc: "primary button border" },
  { name: "secondary", desc: "secondary surfaces" },
  { name: "secondary-foreground", desc: "text on secondary" },
  { name: "muted", desc: "subtle surfaces, hover" },
  { name: "muted-foreground", desc: "subdued text" },
  { name: "accent", desc: "highlighted items" },
  { name: "accent-foreground", desc: "text on accent" },
  { name: "badge", desc: "badge background" },
  { name: "badge-foreground", desc: "text on badge" },
  { name: "destructive", desc: "danger, delete" },
  { name: "destructive-border", desc: "destructive button border" },
  { name: "border", desc: "default borders" },
  { name: "input", desc: "input borders" },
  { name: "ring", desc: "focus ring" },
];

const shadowTokens = [
  { name: "shadow-depth-button", desc: "secondary / outline buttons" },
  { name: "shadow-depth-button-primary", desc: "primary buttons" },
  { name: "shadow-depth-button-destructive", desc: "destructive buttons" },
  { name: "shadow-depth-floating", desc: "tooltips, lighter floating UI" },
  { name: "shadow-depth-elevated", desc: "dialogs, popovers" },
  { name: "shadow-depth-tooltip", desc: "tooltip surface" },
];

// ─── helpers ─────────────────────────────────────────────────────────────────

const Section = ({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) => (
  <section className="flex flex-col gap-4">
    <header className="flex flex-col gap-1">
      <h2 className="font-content text-xl font-semibold">{title}</h2>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </header>
    <div className="flex flex-col gap-4">{children}</div>
  </section>
);

const Row = ({
  label,
  children,
  align = "center",
}: {
  label: string;
  children: React.ReactNode;
  align?: "center" | "start";
}) => (
  <div
    className={`grid grid-cols-[140px_1fr] gap-4 ${
      align === "start" ? "items-start" : "items-center"
    }`}
  >
    <div className="font-mono text-[11px] text-muted-foreground">{label}</div>
    <div className="flex flex-wrap items-center gap-2">{children}</div>
  </div>
);

const ColorSwatch = ({ name, desc }: { name: string; desc: string }) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const [value, setValue] = React.useState<string>("");
  React.useEffect(() => {
    if (!ref.current) return;
    const v = getComputedStyle(ref.current)
      .getPropertyValue(`--${name}`)
      .trim();
    setValue(v);
  }, [name]);
  return (
    <div
      ref={ref}
      className="flex flex-col gap-2 rounded-lg bg-card p-3 text-xs"
    >
      <div
        className="h-12 w-full rounded-md border border-border/40"
        style={{ background: `var(--${name})` }}
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="truncate font-mono text-[11px]">{name}</div>
        <div className="truncate text-[10px] text-muted-foreground">{desc}</div>
        <div className="truncate font-mono text-[10px] text-muted-foreground">
          {value || "…"}
        </div>
      </div>
    </div>
  );
};

const ShadowSwatch = ({ name, desc }: { name: string; desc: string }) => (
  <div className="flex flex-col gap-2 rounded-lg bg-card p-3 text-xs">
    <div
      className={`h-12 w-full rounded-md bg-card ${name}`}
      style={{ background: "var(--card)" }}
    />
    <div className="flex flex-col gap-0.5">
      <div className="font-mono text-[11px]">{name}</div>
      <div className="text-[10px] text-muted-foreground">{desc}</div>
    </div>
  </div>
);

const iconSamples = [
  { Icon: IconHome, name: "IconHome" },
  { Icon: IconSearch, name: "IconSearch" },
  { Icon: IconSettings, name: "IconSettings" },
  { Icon: IconUser, name: "IconUser" },
  { Icon: IconPlus, name: "IconPlus" },
  { Icon: IconX, name: "IconX" },
  { Icon: IconCheck, name: "IconCheck" },
  { Icon: IconChevronDown, name: "IconChevronDown" },
  { Icon: IconDots, name: "IconDots" },
  { Icon: IconStar, name: "IconStar" },
  { Icon: IconHeart, name: "IconHeart" },
  { Icon: IconBookmark, name: "IconBookmark" },
  { Icon: IconPinFilled, name: "IconPinFilled" },
  { Icon: IconArchive, name: "IconArchive" },
  { Icon: IconTrash, name: "IconTrash" },
  { Icon: IconPencil, name: "IconPencil" },
  { Icon: IconCopy, name: "IconCopy" },
  { Icon: IconClipboard, name: "IconClipboard" },
  { Icon: IconExternalLink, name: "IconExternalLink" },
  { Icon: IconLink, name: "IconLink" },
  { Icon: IconShare, name: "IconShare" },
  { Icon: IconDownload, name: "IconDownload" },
  { Icon: IconEye, name: "IconEye" },
  { Icon: IconEyeOff, name: "IconEyeOff" },
  { Icon: IconFilter, name: "IconFilter" },
  { Icon: IconAdjustments, name: "IconAdjustments" },
  { Icon: IconSparkles, name: "IconSparkles" },
  { Icon: IconBolt, name: "IconBolt" },
  { Icon: IconInfoCircle, name: "IconInfoCircle" },
  { Icon: IconHelp, name: "IconHelp" },
  { Icon: IconFileFilled, name: "IconFileFilled" },
  { Icon: IconCircle, name: "IconCircle" },
  { Icon: IconSun, name: "IconSun" },
  { Icon: IconMoon, name: "IconMoon" },
];

const DesignSystemPage = () => {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }
  const [tab, setTab] = React.useState("first");
  const [checked, setChecked] = React.useState(true);
  const [switched, setSwitched] = React.useState(true);
  const [sliderValue, setSliderValue] = React.useState<number>(40);
  const [menuChecked, setMenuChecked] = React.useState(true);
  const [menuSwitched, setMenuSwitched] = React.useState(true);

  const toggleTheme = () => document.documentElement.classList.toggle("dark");

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex max-w-5xl flex-col gap-16 px-6 py-12">
        <header className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="font-content text-3xl font-semibold tracking-tight">
              Design system
            </h1>
            <p className="text-sm text-muted-foreground">
              Every UI primitive used in the reading list app: buttons,
              dropdowns, dialogs, badges, colors, shadows, icons.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={toggleTheme}>
            <IconSun /> / <IconMoon />
            Toggle theme
          </Button>
        </header>

        {/* ─── colors ─────────────────────────────────────────────────────── */}
        <Section
          title="Colors"
          description="oklch tokens defined in app/globals.css. Toggle theme to see light/dark values."
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {colorTokens.map((t) => (
              <ColorSwatch key={t.name} name={t.name} desc={t.desc} />
            ))}
          </div>
        </Section>

        {/* ─── shadows ────────────────────────────────────────────────────── */}
        <Section title="Shadows" description="Depth utilities for elevation.">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {shadowTokens.map((t) => (
              <ShadowSwatch key={t.name} name={t.name} desc={t.desc} />
            ))}
          </div>
        </Section>

        {/* ─── typography ─────────────────────────────────────────────────── */}
        <Section
          title="Typography"
          description="font-sans is the default (DM Sans). font-content is also DM Sans but reserved for titles & content."
        >
          <div className="flex flex-col gap-4 rounded-lg bg-card p-4">
            <div className="font-content text-3xl font-semibold">
              The quick brown fox, font-content / 3xl
            </div>
            <div className="font-content text-xl font-semibold">
              The quick brown fox, font-content / xl
            </div>
            <div className="text-base">
              The quick brown fox jumps over the lazy dog, font-sans / base
            </div>
            <div className="text-sm">
              The quick brown fox jumps over the lazy dog, font-sans / sm
            </div>
            <div className="text-xs">
              The quick brown fox jumps over the lazy dog, font-sans / xs
            </div>
            <div className="text-xs text-muted-foreground">
              Muted: subtle helper text and metadata
            </div>
          </div>
        </Section>

        {/* ─── buttons ────────────────────────────────────────────────────── */}
        <Section
          title="Buttons"
          description="All variants × all sizes. Default size is sm-ish (h-7)."
        >
          <Row label="variant=default">
            <Button>Default</Button>
            <Button>
              <IconPlus /> With icon
            </Button>
            <Button disabled>Disabled</Button>
            <Button>
              <Spinner className="size-3.5" /> Loading
            </Button>
          </Row>
          <Row label="variant=outline">
            <Button variant="outline">Outline</Button>
            <Button variant="outline">
              <IconDownload /> Download
            </Button>
            <Button variant="outline" disabled>
              Disabled
            </Button>
          </Row>
          <Row label="variant=secondary">
            <Button variant="secondary">Secondary</Button>
            <Button variant="secondary">
              <IconCopy /> Copy
            </Button>
          </Row>
          <Row label="variant=ghost">
            <Button variant="ghost">Ghost</Button>
            <Button variant="ghost">
              <IconSettings /> Settings
            </Button>
          </Row>
          <Row label="variant=destructive">
            <Button variant="destructive">Destructive</Button>
            <Button variant="destructive">
              <IconTrash /> Delete
            </Button>
          </Row>
          <Row label="variant=link">
            <Button variant="link">Link button</Button>
            <Button variant="link">
              <IconExternalLink /> Open
            </Button>
          </Row>

          <Separator className="my-2" />

          <Row label="size=xs">
            <Button size="xs">xs</Button>
            <Button size="xs" variant="outline">
              xs outline
            </Button>
            <Button size="xs" variant="secondary">
              xs secondary
            </Button>
          </Row>
          <Row label="size=sm">
            <Button size="sm">sm</Button>
            <Button size="sm" variant="outline">
              sm outline
            </Button>
            <Button size="sm" variant="ghost">
              sm ghost
            </Button>
          </Row>
          <Row label="size=default">
            <Button>default</Button>
            <Button variant="outline">default outline</Button>
          </Row>
          <Row label="size=lg">
            <Button size="lg">lg</Button>
            <Button size="lg" variant="outline">
              lg outline
            </Button>
          </Row>

          <Separator className="my-2" />

          <Row label="size=icon-xs">
            <Button size="icon-xs" variant="ghost">
              <IconX />
            </Button>
            <Button size="icon-xs" variant="outline">
              <IconPlus />
            </Button>
            <Button size="icon-xs">
              <IconCheck />
            </Button>
          </Row>
          <Row label="size=icon-sm">
            <Button size="icon-sm" variant="ghost">
              <IconDots />
            </Button>
            <Button size="icon-sm" variant="outline">
              <IconPencil />
            </Button>
            <Button size="icon-sm">
              <IconBookmark />
            </Button>
          </Row>
          <Row label="size=icon">
            <Button size="icon" variant="ghost">
              <IconSettings />
            </Button>
            <Button size="icon" variant="outline">
              <IconSearch />
            </Button>
            <Button size="icon">
              <IconPlus />
            </Button>
          </Row>
          <Row label="size=icon-lg">
            <Button size="icon-lg" variant="ghost">
              <IconArchive />
            </Button>
            <Button size="icon-lg" variant="outline">
              <IconShare />
            </Button>
            <Button size="icon-lg" variant="destructive">
              <IconTrash />
            </Button>
          </Row>
        </Section>

        {/* ─── button group ───────────────────────────────────────────────── */}
        <Section
          title="Button group"
          description="Joined buttons that share a border / shadow."
        >
          <Row label="outline">
            <ButtonGroup>
              <Button variant="outline" size="sm">
                Review
              </Button>
              <Button variant="outline" size="icon-sm">
                <IconChevronDown />
              </Button>
            </ButtonGroup>
            <ButtonGroup>
              <Button variant="outline" size="sm">
                <IconEye /> Read
              </Button>
              <Button variant="outline" size="sm">
                <IconEyeOff /> Unread
              </Button>
              <Button variant="outline" size="sm">
                <IconFilter /> All
              </Button>
            </ButtonGroup>
          </Row>
        </Section>

        {/* ─── badges ─────────────────────────────────────────────────────── */}
        <Section title="Badges">
          <Row label="variants">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge variant="ghost">Ghost</Badge>
            <Badge variant="link">Link</Badge>
          </Row>
          <Row label="with icon">
            <Badge>
              <IconCheck />
              Done
            </Badge>
            <Badge variant="secondary">
              <IconStar />
              Starred
            </Badge>
            <Badge variant="outline">
              <IconBookmark />
              Saved
            </Badge>
            <Badge variant="destructive">
              <IconX />
              Blocked
            </Badge>
          </Row>
        </Section>

        {/* ─── inputs / form controls ─────────────────────────────────────── */}
        <Section title="Form controls">
          <Row label="Input">
            <Input placeholder="Default input" className="max-w-xs" />
            <Input disabled placeholder="Disabled" className="max-w-xs" />
          </Row>
          <Row label="Checkbox">
            <Checkbox
              checked={checked}
              onCheckedChange={(v) => setChecked(v === true)}
            />
            <span className="text-xs text-muted-foreground">
              {checked ? "Checked" : "Unchecked"}
            </span>
            <Checkbox checked={false} />
            <Checkbox disabled checked={true} />
          </Row>
          <Row label="Switch">
            <Switch checked={switched} onCheckedChange={setSwitched} />
            <span className="text-xs text-muted-foreground">
              {switched ? "On" : "Off"}
            </span>
            <Switch checked={false} />
            <Switch disabled checked={true} />
          </Row>
          <Row label="Slider">
            <div className="w-64">
              <Slider
                value={sliderValue}
                onValueChange={(v) => setSliderValue(Number(v))}
              />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {sliderValue}
            </span>
          </Row>
        </Section>

        {/* ─── tabs ───────────────────────────────────────────────────────── */}
        <Section title="Tabs">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="first">First</TabsTrigger>
              <TabsTrigger value="second">Second</TabsTrigger>
              <TabsTrigger value="third">Third</TabsTrigger>
            </TabsList>
            <TabsContent value="first" className="pt-3 text-sm">
              First panel content.
            </TabsContent>
            <TabsContent value="second" className="pt-3 text-sm">
              Second panel content.
            </TabsContent>
            <TabsContent value="third" className="pt-3 text-sm">
              Third panel content.
            </TabsContent>
          </Tabs>
        </Section>

        {/* ─── tooltip ────────────────────────────────────────────────────── */}
        <Section
          title="Tooltips"
          description="Hover and wait, default delay is 1.5s. Press to open faster."
        >
          <Row label="hover targets">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button variant="ghost" size="icon-sm">
                    <IconInfoCircle />
                  </Button>
                }
              />
              <TooltipContent>Helpful information</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button variant="outline" size="sm">
                    Hover me
                  </Button>
                }
              />
              <TooltipContent>Tooltip on a button</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button variant="ghost" size="icon-sm">
                    <IconHelp />
                  </Button>
                }
              />
              <TooltipContent side="right">Right side</TooltipContent>
            </Tooltip>
          </Row>
        </Section>

        {/* ─── dropdown menu ──────────────────────────────────────────────── */}
        <Section
          title="Dropdown menu"
          description="Items, labels, separators, checkbox items, switch items, sub-menus, shortcuts."
        >
          <Row label="basic">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="sm">
                    Open menu <IconChevronDown />
                  </Button>
                }
              />
              <DropdownMenuContent align="start">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuItem>
                    <IconPencil /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <IconCopy /> Duplicate
                    <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <IconShare /> Share
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={menuChecked}
                  onCheckedChange={(v) => setMenuChecked(v === true)}
                >
                  Show completed
                </DropdownMenuCheckboxItem>
                <DropdownMenuSwitchItem
                  checked={menuSwitched}
                  onCheckedChange={(v) => setMenuSwitched(v === true)}
                >
                  Notifications
                </DropdownMenuSwitchItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <IconAdjustments /> More
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem>
                      <IconDownload /> Export
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <IconArchive /> Archive
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive">
                  <IconTrash /> Delete
                  <DropdownMenuShortcut>⌫</DropdownMenuShortcut>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon-sm">
                    <IconDots />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <IconPinFilled /> Pin
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <IconBookmark /> Bookmark
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <IconExternalLink /> Open in new tab
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </Row>
        </Section>

        {/* ─── dialogs ────────────────────────────────────────────────────── */}
        <Section title="Dialogs">
          <Row label="Dialog">
            <Dialog>
              <DialogTrigger
                render={
                  <Button variant="outline" size="sm">
                    Open dialog
                  </Button>
                }
              />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit profile</DialogTitle>
                  <DialogDescription>
                    Make changes to your profile here. Click save when done.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-2">
                  <Input placeholder="Name" />
                  <Input placeholder="Email" />
                </div>
                <DialogFooter>
                  <DialogClose
                    render={
                      <Button variant="outline" size="sm">
                        Cancel
                      </Button>
                    }
                  />
                  <Button size="sm">Save</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Row>
          <Row label="AlertDialog">
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button variant="destructive" size="sm">
                    Delete item
                  </Button>
                }
              />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the item. This action cannot be
                    undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel size="sm">Cancel</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" size="sm">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </Row>
        </Section>

        {/* ─── keyboard ───────────────────────────────────────────────────── */}
        <Section title="Keyboard">
          <Row label="single">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
            <Kbd>Esc</Kbd>
            <Kbd>↵</Kbd>
            <Kbd>⌫</Kbd>
          </Row>
          <Row label="groups">
            <KbdGroup>
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </KbdGroup>
            <KbdGroup>
              <Kbd>⌘</Kbd>
              <Kbd>⇧</Kbd>
              <Kbd>P</Kbd>
            </KbdGroup>
            <KbdGroup>
              <Kbd>Ctrl</Kbd>
              <Kbd>N</Kbd>
            </KbdGroup>
          </Row>
        </Section>

        {/* ─── feedback ───────────────────────────────────────────────────── */}
        <Section title="Feedback">
          <Row label="Spinner">
            <Spinner className="size-3" />
            <Spinner className="size-4" />
            <Spinner className="size-5" />
            <Spinner className="size-6" />
          </Row>
          <Row label="Skeleton" align="start">
            <div className="flex w-72 flex-col gap-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </Row>
        </Section>

        {/* ─── separators ─────────────────────────────────────────────────── */}
        <Section title="Separators">
          <Row label="horizontal" align="start">
            <div className="flex w-full max-w-sm flex-col gap-2 text-xs">
              <span>Above</span>
              <Separator />
              <span>Below</span>
            </div>
          </Row>
          <Row label="vertical">
            <div className="flex h-6 items-center gap-3 text-xs">
              <span>Left</span>
              <Separator orientation="vertical" />
              <span>Middle</span>
              <Separator orientation="vertical" />
              <span>Right</span>
            </div>
          </Row>
        </Section>

        {/* ─── icons ──────────────────────────────────────────────────────── */}
        <Section
          title="Icons"
          description="@tabler/icons-react, a sample of icons used across the app."
        >
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {iconSamples.map(({ Icon, name }) => (
              <div
                key={name}
                className="flex flex-col items-center justify-center gap-1.5 rounded-lg bg-card p-3 text-[10px] text-muted-foreground"
              >
                <Icon className="size-5 text-foreground" />
                <span className="w-full truncate text-center font-mono">
                  {name}
                </span>
              </div>
            ))}
          </div>
        </Section>

        <footer className="flex items-center justify-between gap-4 pt-8 text-xs text-muted-foreground">
          <span>End of design system</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            <IconArrowRight className="rotate-[-90deg]" />
            Back to top
          </Button>
        </footer>
      </div>
    </div>
  );
};

export default DesignSystemPage;
