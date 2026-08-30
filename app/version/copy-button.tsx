import { IconCheck, IconCopy } from "@tabler/icons-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/system/button";

export const CopyButton = ({ value }: { value: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  }, [value]);

  return (
    <Button variant="secondary" size="sm" onClick={handleCopy}>
      {copied ? <IconCheck /> : <IconCopy />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
};
