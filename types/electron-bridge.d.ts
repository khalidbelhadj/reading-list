export {};

declare global {
  interface Window {
    readingList?: {
      platform: "electron";
      openExternal: (url: string) => Promise<boolean>;
      onDeepLink: (cb: (url: string) => void) => () => void;
      getNativeTheme: () => Promise<boolean>;
      onNativeThemeChange: (cb: (dark: boolean) => void) => () => void;
    };
  }
}
