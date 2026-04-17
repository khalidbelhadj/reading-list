import React from "react";
import { useMutation } from "@tanstack/react-query";

import { fetchPageTitle } from "@/app/actions";

const isValidUrl = (str: string): boolean => {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

export const useAutofill = (
  url: string,
  title: string,
  setTitle: (title: string) => void,
) => {
  const setTitleRef = React.useRef(setTitle);
  setTitleRef.current = setTitle;

  const autofillMutation = useMutation({
    mutationFn: (target: string) => fetchPageTitle(target),
    onSuccess: (result) => {
      if (result) setTitleRef.current(result);
    },
  });

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
