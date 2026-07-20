import type * as React from "react";

export {};

// Minimal structural types for the Electron <webview> tag used by the in-app
// viewer (components/viewer/webview-engine.tsx). The app renderer doesn't
// depend on electron's own types — only these members are used.
declare global {
  interface WebviewRect {
    x: number;
    y: number;
    width: number;
    height: number;
  }

  interface WebviewIpcMessageEvent extends Event {
    channel: string;
    args: unknown[];
  }

  interface WebviewElement extends HTMLElement {
    src: string;
    send(channel: string, ...args: unknown[]): Promise<void>;
    capturePage(rect?: WebviewRect): Promise<{ toDataURL(): string }>;
    getURL(): string;
    getTitle(): string;
    canGoBack(): boolean;
    canGoForward(): boolean;
    goBack(): void;
    goForward(): void;
    reload(): void;
  }

  interface Window {
    readingList?: {
      platform: "electron";
      openExternal: (url: string) => Promise<boolean>;
      focusWindow: () => Promise<void>;
      onDeepLink: (cb: (url: string) => void) => () => void;
      getNativeTheme: () => Promise<boolean>;
      onNativeThemeChange: (cb: (dark: boolean) => void) => () => void;
      getZoomFactor: () => Promise<number>;
      onZoomChange: (cb: (zoom: number) => void) => () => void;
    };
  }
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<
        React.HTMLAttributes<WebviewElement>,
        WebviewElement
      > & {
        src?: string;
        partition?: string;
      };
    }
  }
}
