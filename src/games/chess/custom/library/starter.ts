import { createVariantFromPreset } from "../engine/presets.ts";
import type { GameVariant } from "../engine/types.ts";
import type { VariantRepository } from "../storage/variantRepository.ts";

export const STARTER_VARIANT_NAME = "My First Chess Variant";

/**
 * The starter is an ordinary variant built from the standard preset — no
 * special editor behaviour. Once saved, it can be played, edited, shared or
 * deleted like anything else.
 */
export function createStarterVariant(): GameVariant {
  const variant = createVariantFromPreset("standard");
  return {
    ...variant,
    name: STARTER_VARIANT_NAME,
    description: "Standard 8×8 chess with the normal pieces and rules. Open it in Create to see how a variant is built, then change anything you like.",
  };
}

export const UNTITLED_VARIANT_NAME = "Untitled Chess Variant";

/** A fresh variant for Create → Overview: standard chess until a base preset is chosen. */
export function createUntitledVariant(): GameVariant {
  return { ...createVariantFromPreset("standard"), name: UNTITLED_VARIANT_NAME, description: "" };
}

/**
 * Apply a preset's gameplay to a variant while keeping what the player owns:
 * identity, name, description, tags and lineage.
 */
export function withBasePreset(current: GameVariant, preset: GameVariant): GameVariant {
  return {
    ...preset,
    id: current.id,
    name: current.name,
    description: current.description,
    version: current.version,
    createdAt: current.createdAt,
    updatedAt: current.updatedAt,
    remixedFrom: current.remixedFrom,
    originalVariantId: current.originalVariantId,
    authorId: current.authorId,
    tags: current.tags,
  };
}

/** Per storage scope ("local" or "user:<id>"), so each library is seeded at most once. */
export const starterFlagKey = (scope: string) => `chess-custom:starter:v1:${scope}`;

export interface FlagStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export const localFlagStore: FlagStore = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* Storage is optional. */
    }
  },
};

const inFlight = new Map<string, Promise<GameVariant | null>>();

/**
 * Seed the starter only when the library is genuinely empty and has never
 * been seeded. A library that already has variants is marked as seeded, so
 * deleting everything later never brings the starter back.
 */
export function ensureStarterVariant({
  repository,
  scope,
  existingCount,
  flags = localFlagStore,
}: {
  repository: Pick<VariantRepository, "save">;
  scope: string;
  existingCount: number;
  flags?: FlagStore;
}): Promise<GameVariant | null> {
  const key = starterFlagKey(scope);
  if (existingCount > 0) {
    if (!flags.get(key)) flags.set(key, "existing");
    return Promise.resolve(null);
  }
  if (flags.get(key)) return Promise.resolve(null);
  const running = inFlight.get(key);
  if (running) return running;
  const task = repository
    .save(createStarterVariant())
    .then((saved) => {
      flags.set(key, "created");
      return saved;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, task);
  return task;
}
