// Where an item's favicon comes from: the stored one when the extractor
// found it, otherwise Google's favicon service for the item's host.
export const faviconSrc = (item: {
  faviconUrl?: string | null;
  url: string;
}): string | null => {
  if (item.faviconUrl) return item.faviconUrl;
  try {
    const domain = new URL(item.url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return null;
  }
};
