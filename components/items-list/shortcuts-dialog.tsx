"use client";

import React from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { getShortcutGroups } from "@/lib/shortcuts";

export const ShortcutsDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const groups = getShortcutGroups();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
          {groups.map((group) => (
            <div key={group.title} className="flex flex-col gap-2">
              <div className="font-content text-xs font-medium text-muted-foreground">
                {group.title}
              </div>
              {group.shortcuts.map((shortcut) => (
                <div
                  key={shortcut.label}
                  className="flex items-center justify-between gap-4"
                >
                  <span>{shortcut.label}</span>
                  <div className="flex shrink-0 items-center gap-1">
                    {shortcut.combos.map((combo, comboIndex) => (
                      <div key={comboIndex} className="flex items-center gap-1">
                        {comboIndex > 0 && (
                          <span className="text-muted-foreground/40">/</span>
                        )}
                        <KbdGroup>
                          {combo.map((token, tokenIndex) => (
                            <Kbd key={tokenIndex} size="sm">
                              {token}
                            </Kbd>
                          ))}
                        </KbdGroup>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
