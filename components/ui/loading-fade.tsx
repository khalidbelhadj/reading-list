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
          "animate-in fade-in zoom-in-99 duration-200 origin-top",
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
        "transition-all duration-150 origin-top",
        stage === "fade-out" ? "opacity-0 scale-[0.99]" : "opacity-100 scale-100",
        className,
      )}
    >
      {skeleton}
    </div>
  );
};
