"use client";

import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import React from "react";
import { toast } from "sonner";

import { useDevDevtools } from "@/lib/use-dev-devtools";

const makeQueryClient = () => {
  const queryClient: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
      },
    },
    mutationCache: new MutationCache({
      onError: (error) => {
        if (error instanceof Error && error.message === "Unauthorized") {
          window.location.href = "/login";
          return;
        }
        const message =
          error instanceof Error ? error.message : "Something went wrong";
        const [title, ...rest] = message.split(". ");
        const description = rest.join(". ");
        toast.error(
          title.replace(/\.$/, ""),
          description ? { description } : undefined,
        );
      },
    }),
  });
  return queryClient;
};

let browserQueryClient: QueryClient | undefined;

const getQueryClient = () => {
  if (typeof window === "undefined") return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
};

export const QueryProvider = ({ children }: { children: React.ReactNode }) => {
  const queryClient = getQueryClient();
  const [devtoolsEnabled] = useDevDevtools();

  // One-shot cleanup for the removed Prompts feature's localStorage entry.
  // Safe to remove once it has shipped to all clients.
  React.useEffect(() => {
    try {
      localStorage.removeItem("copy-prompts");
    } catch {}
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" && devtoolsEnabled && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
};
