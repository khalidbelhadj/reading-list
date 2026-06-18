"use client";

import React from "react";
import { cn } from "@/lib/utils";

const FADE_MS = 150;

export const LoadingFade = ({
  loading,
  skeleton,
  children,
  className,
}: {
  loading: boolean;
  skeleton: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) => {
  const [stage, setStage] = React.useState<"skeleton" | "fade-out" | "content">(
    loading ? "skeleton" : "content",
  );
  const sawSkeleton = React.useRef(loading);

  React.useEffect(() => {
    if (loading) {
      sawSkeleton.current = true;
      setStage("skeleton");
    } else if (stage === "skeleton") {
      setStage("fade-out");
    }
  }, [loading, stage]);

  React.useEffect(() => {
    if (stage !== "fade-out") return;
    const t = setTimeout(() => setStage("content"), FADE_MS);
    return () => clearTimeout(t);
  }, [stage]);

  if (stage === "content") {
    if (!sawSkeleton.current) {
      return <div className={className}>{children}</div>;
    }
    return (
      <div
        className={cn(
          "origin-top animate-in duration-200 fade-in zoom-in-99",
          className,
        )}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "origin-top transition-all duration-150",
        stage === "fade-out"
          ? "scale-[0.99] opacity-0"
          : "scale-100 opacity-100",
        className,
      )}
    >
      {skeleton}
    </div>
  );
};
