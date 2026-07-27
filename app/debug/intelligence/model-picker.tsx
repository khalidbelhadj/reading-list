// Active embedding model selector. The selection is app-global (one model per
// instance) because the worker drains every user's rows and one HNSW index
// covers the table — see lib/extract/embedding-config.ts.
//
// Switching is non-destructive: nothing is deleted, existing rows keep their
// vectors and their stored model id, and the drain paths re-embed them in the
// background. What *does* change immediately is search — it filters to the
// active model, so rows still on the old one drop out of results until they
// re-embed. That is the one consequence worth showing at the moment of the
// click, which is what the coverage summary below is for.
import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import React from "react";

import { type ModelCoverage } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  EMBEDDING_MODELS,
  type EmbeddingConfig,
  embeddingModelId,
  isModelSupported,
  PROVIDER_KEY_ENV,
  PROVIDER_LABELS,
} from "@/lib/extract/embedding-config";
import { cn } from "@/lib/utils";

const selectable = EMBEDDING_MODELS.filter(isModelSupported);

export const ModelPicker = ({
  config,
  activeModel,
  coverage,
  pending,
  onSelect,
}: {
  config: EmbeddingConfig | undefined;
  activeModel: string | undefined;
  // Distinct stored models across the corpus, so a switch's cost is visible.
  coverage: ModelCoverage[];
  pending: boolean;
  onSelect: (next: EmbeddingConfig) => void;
}) => {
  // Anything not on the active model is excluded from search until it
  // re-embeds. Summing here rather than in SQL keeps it in step with whatever
  // the picker currently shows as active.
  const strandedItems = React.useMemo(
    () =>
      coverage
        .filter((entry) => entry.model !== activeModel)
        .reduce((total, entry) => total + entry.items, 0),
    [coverage, activeModel],
  );

  const label = config ? `${config.provider}:${config.model}` : "…";

  return (
    <span className="flex items-center gap-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm" disabled={pending}>
              <span className="font-mono text-xs">{label}</span>
              <IconChevronDown />
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="w-80">
          <DropdownMenuLabel>Embedding model</DropdownMenuLabel>
          {selectable.map((model) => {
            const id = embeddingModelId({
              provider: model.provider,
              model: model.id,
            });
            const isActive =
              config?.provider === model.provider && config.model === model.id;
            const keyEnv = PROVIDER_KEY_ENV[model.provider];
            return (
              <DropdownMenuItem
                key={id}
                onClick={() =>
                  onSelect({
                    provider: model.provider,
                    model: model.id,
                    ...(model.provider === "ollama"
                      ? { ollamaUrl: config?.ollamaUrl }
                      : {}),
                  })
                }
              >
                <IconCheck className={cn(!isActive && "opacity-0")} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-baseline gap-1.5">
                    <span className="font-mono text-xs">{model.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {PROVIDER_LABELS[model.provider]}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {model.nativeDimensions} dims
                    {model.note ? ` · ${model.note}` : ""}
                    {keyEnv ? ` · needs ${keyEnv}` : ""}
                  </span>
                </span>
              </DropdownMenuItem>
            );
          })}
          {coverage.length > 1 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Corpus</DropdownMenuLabel>
              {coverage.map((entry) => (
                <div
                  key={entry.model}
                  className="flex items-center justify-between gap-2 px-2 py-1 text-xs"
                >
                  <span className="truncate font-mono text-muted-foreground">
                    {entry.model}
                  </span>
                  <Badge
                    variant={
                      entry.model === activeModel ? "secondary" : "outline"
                    }
                    className="tabular-nums"
                  >
                    {entry.items}
                  </Badge>
                </div>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {strandedItems > 0 && (
        <span
          className="inline-flex items-center gap-1 text-xs text-muted-foreground"
          title="Embedded with a different model, so excluded from search until re-embedded. The drain paths pick these up automatically."
        >
          <Badge variant="destructive" className="tabular-nums">
            {strandedItems}
          </Badge>
          off-model
        </span>
      )}
    </span>
  );
};
