import { type Demo } from "@/components/system/demo";

import { ItemThumbnail } from "./item-thumbnail";

export const demo: Demo = {
  title: "Item thumbnail",
  description:
    "The cozy-row preview: a YouTube thumbnail for videos, otherwise the page peeking from its tray (a stored PDF first-page render fills it; a stylized placeholder stands in). Favicon badge in the corner.",
  render: () => (
    <div className="flex items-start gap-3">
      <ItemThumbnail
        item={{
          url: "https://www.youtube.com/watch?v=x1npPrzyKfs",
          title: "Linux Container Primitives",
        }}
        previewImageUrl={null}
        className="aspect-video w-24 rounded-[3px]"
      />
      <ItemThumbnail
        item={{
          url: "https://arxiv.org/abs/1908.01262",
          title: "A systematic review of fuzzing based on machine learning",
        }}
        previewImageUrl={null}
        className="aspect-video w-24 rounded-[3px]"
      />
    </div>
  ),
};
