function trigrams(str: string): Set<string> {
  const s = `  ${str.toLowerCase()}  `;
  const result = new Set<string>();
  for (let i = 0; i < s.length - 2; i++) {
    result.add(s.slice(i, i + 3));
  }
  return result;
}

export function similarity(a: string, b: string): number {
  const ta = trigrams(a);
  const tb = trigrams(b);
  let intersection = 0;
  for (const t of ta) {
    if (tb.has(t)) intersection++;
  }
  const union = ta.size + tb.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function fuzzyMatch(item: { title: string; url: string }, query: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();

  // Exact substring match gets a boost
  if (item.title.toLowerCase().includes(q) || item.url.toLowerCase().includes(q)) {
    return 1;
  }

  // Trigram similarity on title
  return similarity(item.title, query);
}
