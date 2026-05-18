"use client";

import React from "react";

const GlobalError = ({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) => {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          margin: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: "16px",
            maxWidth: "28rem",
            width: "100%",
          }}
        >
          <div>
            <h1 style={{ fontSize: "18px", margin: 0, marginBottom: "4px" }}>
              Something went wrong
            </h1>
            <p
              style={{
                fontSize: "14px",
                color: "#71717a",
                margin: 0,
              }}
            >
              We hit an unexpected error. Try again, and if it keeps happening
              let us know.
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={reset}
              style={{
                fontSize: "14px",
                padding: "6px 12px",
                borderRadius: "8px",
                background: "#18181b",
                color: "white",
                border: "none",
                cursor: "pointer",
              }}
            >
              Reload
            </button>
            <button
              onClick={() => {
                window.location.href = "/";
              }}
              style={{
                fontSize: "14px",
                padding: "6px 12px",
                borderRadius: "8px",
                background: "transparent",
                color: "#18181b",
                border: "none",
                cursor: "pointer",
              }}
            >
              Go home
            </button>
          </div>
          {error.digest && (
            <p
              style={{
                fontSize: "12px",
                color: "#a1a1aa",
                fontFamily: "ui-monospace, monospace",
                margin: 0,
              }}
            >
              ref: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
};

export default GlobalError;
