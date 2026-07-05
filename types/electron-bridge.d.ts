export {};

declare global {
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
