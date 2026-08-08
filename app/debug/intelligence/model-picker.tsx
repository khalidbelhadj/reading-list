// Active embedding model selector. The selection is app-global (one model per
// instance) because the worker drains every user's rows and one HNSW index
// covers the table — see lib/extract/embedding-config.ts.
//
// Switching is non-destructive: nothing is deleted, existing rows keep their
// vectors and their stored model id, and the drain paths re-embed them in the
// background. What *does* change immediately is search — it filters to the
// active model, so rows still on the old one drop out of results until they
// re-embed. That "off-model" count lives inside the dropdown, at the moment of
// the click, since that is the one consequence worth showing.
import { IconCheck, IconChevronDown, IconServer } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Image from "@/components/ui/image";
import {
  EMBEDDING_MODELS,
  type EmbeddingConfig,
  embeddingModelId,
  type EmbeddingProvider,
  findModel,
  isModelSupported,
  PROVIDER_KEY_ENV,
  PROVIDER_LABELS,
} from "@/lib/extract/embedding-config";
import { cn } from "@/lib/utils";

import { Meta, MetaPair } from "./meta";

const selectable = EMBEDDING_MODELS.filter(isModelSupported);

// Real brand marks for the hosted providers; Ollama (local) has none, so it
// falls back to a server glyph. OpenAI's mark is monochrome black, so it's
// inverted in dark mode; Google's is multicolour and left alone.
const PROVIDER_LOGO: Partial<Record<EmbeddingProvider, string>> = {
  gemini: "/logos/google.png",
  openai: "/logos/openai.webp",
};

const ProviderLogo = ({
  provider,
  className,
}: {
  provider: EmbeddingProvider;
  className?: string;
}) => {
  const src = PROVIDER_LOGO[provider];
  if (!src) return <IconServer className={className} />;
  return (
    <Image
      src={src}
      alt=""
      width={16}
      height={16}
      unoptimized
      className={cn(
        "object-contain",
        provider === "openai" && "dark:invert",
        className,
      )}
    />
  );
};

export const ModelPicker = ({
  config,
  pending,
  onSelect,
}: {
  config: EmbeddingConfig | undefined;
  pending: boolean;
  onSelect: (next: EmbeddingConfig) => void;
}) => {
  // The clean model name, not the "provider:model" id — the provider is shown
  // as its logo instead.
  const activeInfo = config
    ? findModel(config.provider, config.model)
    : undefined;
  const label = activeInfo?.label ?? config?.model ?? "…";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          // h-7 to match the search Input sitting to its right.
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            className="h-7"
          />
        }
      >
        {config && (
          <ProviderLogo provider={config.provider} className="size-3.5" />
        )}
        <span className="font-mono text-xs">{label}</span>
        <IconChevronDown />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        <DropdownMenuGroup>
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
                className="items-start gap-2"
                onClick={() =>
                  onSelect({
                    provider: model.provider,
                    model: model.id,
                    // Only carry ollamaUrl when it's a real string — never
                    // spread `ollamaUrl: undefined` into the serialized arg.
                    ...(model.provider === "ollama" && config?.ollamaUrl
                      ? { ollamaUrl: config.ollamaUrl }
                      : {}),
                  })
                }
              >
                <ProviderLogo
                  provider={model.provider}
                  className="mt-0.5 size-4"
                />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-baseline gap-1.5">
                    <span className="font-mono text-xs">{model.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {PROVIDER_LABELS[model.provider]}
                    </span>
                  </span>
                  <Meta>
                    <MetaPair label="dims" value={model.nativeDimensions} />
                    {keyEnv && <MetaPair label="key" value={keyEnv} />}
                  </Meta>
                  {model.note && (
                    <span className="text-xs text-muted-foreground">
                      {model.note}
                    </span>
                  )}
                </span>
                {isActive && <IconCheck className="mt-0.5 size-3.5 shrink-0" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
