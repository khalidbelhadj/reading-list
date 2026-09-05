import {
  IconCalculator,
  IconCopy,
  IconDatabase,
  IconDeviceDesktop,
  IconDownload,
  IconInfoCircle,
  IconLogout,
  IconMoon,
  IconPalette,
  IconSettings,
  IconSun,
  IconVolume,
} from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React from "react";

import { logout } from "@/app/logout/actions";
import { ExportCsvDialog } from "@/components/shell/export-csv-dialog";
import { Button } from "@/components/system/button";
import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuGroup,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
} from "@/components/system/menu";
import { Tooltip } from "@/components/system/tooltip";
import { broadcastSignOut } from "@/lib/auth-broadcast";
import { useIndexProgress } from "@/lib/index-client";
import { type IndexProgress } from "@/lib/index-worker/protocol";
import { useCurrentUser } from "@/lib/use-current-user";
import { useSettings } from "@/lib/use-settings";

// The index's state in two quiet lines: how many linked items have their
// content, and how many passages are embedded (or what the worker is doing
// instead). Read-only; the worker in lib/index-worker does the work.
const indexLines = (status: IndexProgress | null): [string, string] => {
  if (!status) return ["Index", "Starting"];
  const stuck = status.failed + status.unsupported;
  const items = `${status.ok} of ${status.items} items indexed${
    status.pending > 0 ? `, ${status.pending} queued` : ""
  }${stuck > 0 ? `, ${stuck} skipped` : ""}`;
  if (status.phase === "loading-model") {
    const percent = Math.round((status.modelProgress ?? 0) * 100);
    return [items, `Downloading the embedding model, ${percent}%`];
  }
  if (status.phase === "signed-out" || status.phase === "error") {
    return [items, status.message ?? status.phase];
  }
  const passages =
    status.embedded < status.chunks
      ? `${status.embedded} of ${status.chunks} passages embedded`
      : `${status.chunks} passages embedded`;
  return [items, passages];
};

const THEMES = [
  { value: "system", label: "System", Icon: IconDeviceDesktop },
  { value: "light", label: "Light", Icon: IconSun },
  { value: "dark", label: "Dark", Icon: IconMoon },
] as const;

// The gear at the sidebar's foot: the settings that survived the redesign.
// Theme writes through useSettings (applied globally by SettingsEffects);
// export reuses the classic CSV dialog; Version swaps the pane to the build
// info view (the shell owns the view, so the sidebar hands the callback
// down); the account block sits behind the initials submenu. List view
// options (show read, group/sort/density) belong on the Reading list page,
// not here.
export const SettingsMenu = ({
  onShowVersion,
}: {
  onShowVersion: () => void;
}) => {
  const queryClient = useQueryClient();
  const { settings, setSetting } = useSettings();
  const { data: user } = useCurrentUser();
  const [exportOpen, setExportOpen] = React.useState(false);
  const [indexItems, indexPassages] = indexLines(useIndexProgress());

  const fullName =
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    null;
  const firstName = fullName?.split(" ")[0] ?? "Account";
  const initials = (fullName ?? user?.email ?? "?")
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const logoutMutation = useMutation({
    mutationFn: async (scope: "local" | "global") => {
      // Signal this user's other devices before revoking, so they redirect
      // in near-real-time instead of waiting for their next token refresh.
      if (scope === "global") await broadcastSignOut();
      await logout(scope);
    },
    onSuccess: () => {
      queryClient.clear();
      // Hard navigation out of the SPA — a full reload guarantees all client
      // caches are cleared post-logout.
      window.location.replace("/login");
    },
  });
  const { mutate: runLogout } = logoutMutation;

  const copyUserId = React.useCallback(() => {
    if (user?.id) void navigator.clipboard.writeText(user.id);
  }, [user?.id]);

  return (
    <>
      <Menu>
        <Tooltip content="Settings">
          <MenuTrigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label="Settings" />
            }
          >
            <IconSettings />
          </MenuTrigger>
        </Tooltip>
        <MenuContent side="top" align="end" className="min-w-44">
          <MenuSub>
            <MenuSubTrigger icon={<IconPalette />}>Theme</MenuSubTrigger>
            <MenuSubContent>
              {THEMES.map(({ value, label, Icon }) => (
                <MenuCheckboxItem
                  key={value}
                  icon={<Icon />}
                  checked={settings.theme === value}
                  onCheckedChange={() => setSetting("theme", value)}
                >
                  {label}
                </MenuCheckboxItem>
              ))}
            </MenuSubContent>
          </MenuSub>
          <MenuCheckboxItem
            icon={<IconVolume />}
            checked={settings.sounds}
            onCheckedChange={(checked) => setSetting("sounds", checked)}
          >
            Sounds
          </MenuCheckboxItem>
          <MenuCheckboxItem
            icon={<IconCalculator />}
            checked={settings.showMentalMaths}
            onCheckedChange={(checked) =>
              setSetting("showMentalMaths", checked)
            }
          >
            Mental maths
          </MenuCheckboxItem>
          <MenuItem icon={<IconDownload />} onClick={() => setExportOpen(true)}>
            Export as CSV
          </MenuItem>
          <MenuSub>
            <MenuSubTrigger icon={<IconDatabase />}>Index</MenuSubTrigger>
            <MenuSubContent>
              <MenuGroup>
                <MenuLabel>{indexItems}</MenuLabel>
                <MenuLabel>{indexPassages}</MenuLabel>
              </MenuGroup>
            </MenuSubContent>
          </MenuSub>
          <MenuItem icon={<IconInfoCircle />} onClick={onShowVersion}>
            Version
          </MenuItem>
          <MenuSeparator />
          <MenuSub>
            <MenuSubTrigger
              icon={
                <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-[9px] font-medium text-foreground">
                  {initials}
                </span>
              }
            >
              {firstName}
            </MenuSubTrigger>
            <MenuSubContent>
              <MenuGroup>
                {user?.email && <MenuLabel>{user.email}</MenuLabel>}
                <MenuItem icon={<IconCopy />} onClick={copyUserId}>
                  Copy user ID
                </MenuItem>
                <MenuItem
                  icon={<IconLogout />}
                  onClick={() => runLogout("local")}
                >
                  Log out
                </MenuItem>
                <MenuItem
                  icon={<IconLogout />}
                  onClick={() => runLogout("global")}
                >
                  Log out everywhere
                </MenuItem>
              </MenuGroup>
            </MenuSubContent>
          </MenuSub>
        </MenuContent>
      </Menu>
      <ExportCsvDialog open={exportOpen} onOpenChange={setExportOpen} />
    </>
  );
};
