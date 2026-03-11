import { type DbTag } from "@/lib/types";

export function TagFilters({
  allTags,
  activeTags,
  toggleTag,
  setActiveTags,
}: {
  allTags: DbTag[];
  activeTags: Set<string>;
  toggleTag: (tagName: string) => void;
  setActiveTags: (updater: (prev: Set<string>) => Set<string>) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {allTags.map((tag) => {
        const isActive = activeTags.has(tag.name);
        return (
          <button
            key={tag.id}
            type="button"
            onClick={() => toggleTag(tag.name)}
            className={`px-2.5 py-1.5 sm:px-1.5 sm:py-0.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
              isActive
                ? "bg-foreground text-background"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
            }`}
          >
            {tag.name}
          </button>
        );
      })}
      {activeTags.size > 0 && (
        <button
          type="button"
          onClick={() => setActiveTags(() => new Set())}
          className="px-2.5 py-1.5 sm:px-1.5 sm:py-0.5 rounded-md text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          clear
        </button>
      )}
    </div>
  );
}
