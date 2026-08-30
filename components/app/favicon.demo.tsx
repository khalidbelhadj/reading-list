import { type Demo } from "@/components/system/demo";

import { Favicon } from "./favicon";
import { ListRow } from "./list-row";

const SITES = [
  ["YouTube", "https://www.youtube.com/watch?v=x1npPrzyKfs"],
  ["arXiv", "https://arxiv.org/abs/1908.01262"],
  ["GitHub", "https://github.com/google/brotli"],
  ["Wikipedia", "https://en.wikipedia.org/wiki/Kruskal%27s_algorithm"],
  ["LeetCode", "https://leetcode.com/problems/two-sum/"],
  ["No URL", ""],
] as const;

export const demo: Demo = {
  title: "Favicon",
  description:
    "An item's site icon as served, nothing behind it; a file glyph when there is no URL or the image fails. 16px in rows, 14px in meta, 18px beside a title.",
  render: () => (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        {SITES.map(([name, url]) => (
          <Favicon key={name} item={{ url }} />
        ))}
        <span className="ml-2 text-small text-muted-foreground">16px</span>
      </div>
      <div className="flex items-center gap-3">
        {SITES.map(([name, url]) => (
          <Favicon key={name} item={{ url }} size={20} />
        ))}
        <span className="ml-2 text-small text-muted-foreground">20px</span>
      </div>
      <div className="flex max-w-sm flex-col gap-0.5">
        {SITES.slice(0, 4).map(([name, url]) => (
          <ListRow
            key={name}
            leading={<Favicon item={{ url }} />}
            title={`${name}: a title long enough to fade away at the right edge of the row`}
          />
        ))}
      </div>
    </div>
  ),
};
