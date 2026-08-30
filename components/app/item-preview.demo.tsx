import { type Demo } from "@/components/system/demo";
import { Surface } from "@/components/system/surface";

import { ItemPreview } from "./item-preview";

const NOW = "2026-08-22T02:00:00.000Z";

export const demo: Demo = {
  title: "Item preview",
  description:
    "The hover card's content for an item: the preview thumbnail, full title, and when it was added.",
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Surface kind="frost" padding="sm" className="w-72">
        <ItemPreview
          nowIso={NOW}
          previewImageUrl={null}
          item={{
            title: "Linux Container Primitives: cgroups, namespaces, and more",
            url: "https://www.youtube.com/watch?v=x1npPrzyKfs",
            createdAt: "2026-08-21T23:31:45.000Z",
          }}
        />
      </Surface>
      <Surface kind="frost" padding="sm" className="w-72">
        <ItemPreview
          nowIso={NOW}
          previewImageUrl={null}
          item={{
            title:
              "[1908.01262] A systematic review of fuzzing based on machine learning techniques",
            url: "https://arxiv.org/abs/1908.01262",
            createdAt: "2026-08-15T10:00:00.000Z",
          }}
        />
      </Surface>
    </div>
  ),
};
