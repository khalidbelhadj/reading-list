// Account submenu for the settings menu: current-user identity (initials,
// email, copyable user id) and the log out / log out everywhere actions.
import {
  IconCheck,
  IconCopy,
  IconDevices,
  IconLogout,
} from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React from "react";

import { logout } from "@/app/logout/actions";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { broadcastSignOut } from "@/lib/auth-broadcast";
import { useCurrentUser } from "@/lib/use-current-user";

export const AccountMenu = () => {
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();
  const email = user?.email ?? null;
  const userId = user?.id ?? null;
  const fullName =
    (user?.user_metadata?.full_name as string) ??
    (user?.user_metadata?.name as string) ??
    null;
  const initials = fullName
    ? fullName
        .split(" ")
        .map((w: string) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : null;
  const [mounted, setMounted] = React.useState(false);
  const [copiedUserId, setCopiedUserId] = React.useState(false);

  const logoutMutation = useMutation({
    mutationFn: async (scope: "local" | "global") => {
      // Signal this user's other devices before revoking, so they redirect in
      // near-real-time instead of waiting for their next token refresh.
      if (scope === "global") await broadcastSignOut();
      await logout(scope);
    },
    onSuccess: () => {
      queryClient.clear();
      // Hard navigation out of the SPA rather than a router navigation — a
      // full reload guarantees all client caches are cleared post-logout.
      window.location.replace("/login");
    },
  });

  const handleCopyUserId = React.useCallback(() => {
    if (!userId) return;
    navigator.clipboard.writeText(userId);
    setCopiedUserId(true);
    setTimeout(() => setCopiedUserId(false), 2000);
  }, [userId]);

  const handleLogout = React.useCallback(() => {
    logoutMutation.mutate("local");
  }, [logoutMutation]);

  const handleLogoutEverywhere = React.useCallback(() => {
    logoutMutation.mutate("global");
  }, [logoutMutation]);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || (!fullName && !email)) return null;

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <span className="flex items-center gap-2">
          {initials && (
            <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
              {initials}
            </span>
          )}
          {fullName ?? email}
        </span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        {email && (
          <DropdownMenuGroup>
            <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
              {email}
            </DropdownMenuLabel>
          </DropdownMenuGroup>
        )}
        {userId && (
          <DropdownMenuItem closeOnClick={false} onClick={handleCopyUserId}>
            {copiedUserId ? <IconCheck /> : <IconCopy />}
            {copiedUserId ? "Copied" : "Copy user ID"}
          </DropdownMenuItem>
        )}
        {(email || userId) && <DropdownMenuSeparator />}
        <DropdownMenuItem onClick={handleLogout}>
          <IconLogout />
          Log out
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleLogoutEverywhere}>
          <IconDevices />
          Log out everywhere
        </DropdownMenuItem>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
};
