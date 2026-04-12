import { type DbTag } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

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
          <Badge
            key={tag.id}
            variant={isActive ? "default" : "secondary"}
            className="cursor-pointer"
            render={<button type="button" onClick={() => toggleTag(tag.name)} />}
          >
            {tag.name}
          </Badge>
        );
      })}
      {activeTags.size > 0 && (
        <Badge
          variant="ghost"
          className="cursor-pointer text-muted-foreground"
          render={<button type="button" onClick={() => setActiveTags(() => new Set())} />}
        >
          clear
        </Badge>
      )}
    </div>
  );
}
