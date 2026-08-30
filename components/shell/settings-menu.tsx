import {
  IconCopy,
  IconDeviceDesktop,
  IconDownload,
  IconLogout,
  IconMoon,
  IconPalette,
  IconSettings,
  IconSun,
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
import { useCurrentUser } from "@/lib/use-current-user";
import { useSettings } from "@/lib/use-settings";

const THEMES = [
  { value: "system", label: "System", Icon: IconDeviceDesktop },
  { value: "light", label: "Light", Icon: IconSun },
  { value: "dark", label: "Dark", Icon: IconMoon },
] as const;

// The gear at the sidebar's foot: the settings that survived the redesign.
// Theme writes through useSettings (applied globally by SettingsEffects);
// export reuses the classic CSV dialog; the account block sits behind the
// initials submenu. List view options (show read, group/sort/density) belong
// on the Reading list page, not here.
export const SettingsMenu = () => {
  const queryClient = useQueryClient();
  const { settings, setSetting } = useSettings();
  const { data: user } = useCurrentUser();
  const [exportOpen, setExportOpen] = React.useState(false);

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
          <MenuItem icon={<IconDownload />} onClick={() => setExportOpen(true)}>
            Export as CSV
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
