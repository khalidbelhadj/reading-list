import React from "react";
import { useMutation } from "@tanstack/react-query";

import { fetchPageTitle } from "@/app/actions";

const TYPE_TICK_MS = 25;

const isValidUrl = (str: string): boolean => {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const fallbackTitleFromUrl = (raw: string): string => {
  try {
    return new URL(raw).hostname.replace(/^www\./, "");
  } catch {
    return raw;
  }
};

export const useAutofill = (
  url: string,
  title: string,
  setTitle: (title: string) => void,
) => {
  const setTitleRef = React.useRef(setTitle);
  setTitleRef.current = setTitle;

  // Latest title value, for the typing loop to detect user edits without
  // re-binding the interval on every keystroke.
  const titleRef = React.useRef(title);
  titleRef.current = title;

  // The last value we wrote during typing — if `title` diverges from this,
  // the user typed and we should abort.
  const lastTypedRef = React.useRef<string | null>(null);

  const [targetTitle, setTargetTitle] = React.useState<string | null>(null);

  const autofillMutation = useMutation({
    mutationFn: (target: string) => fetchPageTitle(target),
    onSuccess: (result, target) => {
      // Skip if the user typed something while we were fetching.
      if (titleRef.current.trim()) return;
      const resolved = result?.trim() || fallbackTitleFromUrl(target);
      setTargetTitle(resolved);
    },
    onError: (_err, target) => {
      if (titleRef.current.trim()) return;
      setTargetTitle(fallbackTitleFromUrl(target));
    },
  });

  // Typing animation
  React.useEffect(() => {
    if (targetTitle === null) return;
    // Start from blank — if there's existing text, the user typed first.
    if (titleRef.current !== "") {
      setTargetTitle(null);
      return;
    }
    lastTypedRef.current = "";
    const interval = setInterval(() => {
      if (titleRef.current !== lastTypedRef.current) {
        // User edited — abandon.
        clearInterval(interval);
        setTargetTitle(null);
        lastTypedRef.current = null;
        return;
      }
      const next = targetTitle.slice(0, lastTypedRef.current!.length + 1);
      lastTypedRef.current = next;
      setTitleRef.current(next);
      if (next.length >= targetTitle.length) {
        clearInterval(interval);
        setTargetTitle(null);
        lastTypedRef.current = null;
      }
    }, TYPE_TICK_MS);
    return () => clearInterval(interval);
  }, [targetTitle]);

  const showAutofill = !title.trim() && isValidUrl(url.trim());

  const handleAutofill = React.useCallback(() => {
    const target = url.trim();
    if (!isValidUrl(target)) return;
    autofillMutation.mutate(target);
  }, [url, autofillMutation]);

  const onUrlPaste = React.useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const pasted = e.clipboardData.getData("text/plain").trim();
      if (isValidUrl(pasted) && !title.trim()) {
        autofillMutation.mutate(pasted);
      }
    },
    [title, autofillMutation],
  );

  return {
    showAutofill,
    fetching: autofillMutation.isPending,
    handleAutofill,
    onUrlPaste,
  };
};
