"use client";

import { useCallback, useState } from "react";
import { IconCheck, IconCopy } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";

export const CopyButton = ({ value }: { value: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  }, [value]);

  return (
    <Button variant="outline" size="sm" onClick={handleCopy}>
      {copied ? (
        <IconCheck data-icon="inline-start" />
      ) : (
        <IconCopy data-icon="inline-start" />
      )}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
};
