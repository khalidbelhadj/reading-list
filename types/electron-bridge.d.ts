export {};

declare global {
  interface Window {
    readingList?: {
      platform: "electron";
      openExternal: (url: string) => Promise<boolean>;
      onDeepLink: (cb: (url: string) => void) => () => void;
    };
  }
}
