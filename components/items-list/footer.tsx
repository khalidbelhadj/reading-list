import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { logout } from "@/app/logout/actions";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { useCurrentUser } from "@/lib/use-current-user";
import { downloadItemsCsv, defaultCsvFilename } from "@/lib/csv-export";

export const Footer = () => {
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();
  const email = user?.email ?? null;

  const logoutMutation = useMutation({
    mutationFn: () => logout(),
    onSuccess: () => queryClient.clear(),
  });

  const handleExport = React.useCallback(() => {
    downloadItemsCsv(queryClient, defaultCsvFilename());
  }, [queryClient]);

  return (
    <>
      <div className="mt-8 flex items-center justify-center gap-3 text-xs text-muted-foreground/50 md:fixed md:bottom-4 md:left-4 md:mt-0 md:justify-start">
        <Button
          variant="link"
          className="text-muted-foreground/50 hover:text-muted-foreground p-0 h-auto"
          onClick={handleExport}
        >
          Export
        </Button>
        <span>·</span>
        <Button
          variant="link"
          className="text-muted-foreground/50 hover:text-muted-foreground p-0 h-auto"
          onClick={() => logoutMutation.mutate()}
        >
          Log out
        </Button>
      </div>

      <div className="fixed bottom-4 right-4 flex items-center gap-3">
        {email && (
          <span className="text-xs text-muted-foreground/50">{email}</span>
        )}
        <ThemeToggle />
      </div>
    </>
  );
};
