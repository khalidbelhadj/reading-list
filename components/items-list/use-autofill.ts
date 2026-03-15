import React from "react";
import { fetchPageTitle } from "@/app/actions";

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function useAutofill(
  url: string,
  title: string,
  setTitle: (title: string) => void,
) {
  const [fetching, setFetching] = React.useState(false);

  const showAutofill = !title.trim() && isValidUrl(url.trim());

  const handleAutofill = React.useCallback(async () => {
    if (!isValidUrl(url.trim())) return;
    setFetching(true);
    try {
      const result = await fetchPageTitle(url.trim());
      if (result) setTitle(result);
    } finally {
      setFetching(false);
    }
  }, [url, setTitle]);

  const onUrlPaste = React.useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text/plain").trim();
    if (isValidUrl(pasted) && !title.trim()) {
      // Let the paste complete first, then autofill
      setTimeout(async () => {
        setFetching(true);
        try {
          const result = await fetchPageTitle(pasted);
          if (result) setTitle(result);
        } finally {
          setFetching(false);
        }
      }, 0);
    }
  }, [title, setTitle]);

  return { showAutofill, fetching, handleAutofill, onUrlPaste };
}
