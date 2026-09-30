import {
  Decimal,
  getRemixMineObject,
  REMIX_UPGRADE_KEYS,
  type RemixMineObjectCatalog,
} from "@idle-mine-beyond/core";
import { z } from "zod";
import type { RemixLegacySaveApplicationState } from "./remix-legacy-save-application.js";

const decimalStringSchema = z
  .string()
  .min(1)
  .refine((value) => {
    try {
      return new Decimal(value).toString() !== "NaN";
    } catch {
      return false;
    }
  }, "Expected a valid Decimal string.");

const finiteNumberSchema = z.number().finite();

function upgradeGroupSchema<const Keys extends readonly string[]>(keys: Keys) {
  const shape = Object.fromEntries(
    keys.map((key) => [key, finiteNumberSchema]),
  ) as Record<Keys[number], typeof finiteNumberSchema>;
  return z.object(shape).strict();
}

const remixBeyondSaveStateSchema = z
  .object({
    simulation: z
      .object({
        mineObjectLevel: finiteNumberSchema,
        highestMineObjectLevel: finiteNumberSchema,
        resources: z
          .object({
            money: decimalStringSchema,
            highestMoney: decimalStringSchema,
            gems: decimalStringSchema,
            planetCoins: decimalStringSchema,
            maxPlanetCoins: decimalStringSchema,
            wisdom: decimalStringSchema,
            maxWisdom: decimalStringSchema,
          })
          .strict(),
        powers: z
          .object({
            mining: decimalStringSchema,
            craftsmanship: decimalStringSchema,
            expertise: decimalStringSchema,
            wisdom: decimalStringSchema,
            exquisity: decimalStringSchema,
          })
          .strict(),
        pickaxe: z
          .object({
            name: z.string(),
            power: decimalStringSchema,
            quality: decimalStringSchema,
          })
          .strict(),
        upgrades: z
          .object({
            money: upgradeGroupSchema(REMIX_UPGRADE_KEYS.money),
            gems: upgradeGroupSchema(REMIX_UPGRADE_KEYS.gems),
            planetCoins: upgradeGroupSchema(REMIX_UPGRADE_KEYS.planetCoins),
            wisdom: upgradeGroupSchema(REMIX_UPGRADE_KEYS.wisdom),
          })
          .strict(),
        autoPickaxeTimer: finiteNumberSchema,
        saveTimer: finiteNumberSchema,
        powersUnlocked: z.boolean(),
        usedGemsLevel: finiteNumberSchema,
        lastActiveMs: finiteNumberSchema.optional(),
        story: z
          .object({
            page: finiteNumberSchema,
            highestUnlocked: finiteNumberSchema,
            notifications: finiteNumberSchema,
          })
          .strict(),
      })
      .strict(),
    storyScrollY: finiteNumberSchema,
    settings: z
      .object({
        tab: z.string(),
        upgradeTab: z.string(),
        exportFieldString: z.string(),
        numberFormatterIndex: finiteNumberSchema,
        theme: z.string(),
        showMineObjLevel: z.boolean(),
        showMinCraftDamage: z.boolean(),
      })
      .strict(),
    powerValueExtras: z.array(decimalStringSchema),
  })
  .strict();

export const REMIX_BEYOND_SAVE_VERSION = 1 as const;

export const RemixBeyondSaveV1Schema = z
  .object({
    format: z.literal("idle-mine-beyond"),
    version: z.literal(REMIX_BEYOND_SAVE_VERSION),
    state: remixBeyondSaveStateSchema,
  })
  .strict();

export type RemixBeyondSaveV1 = z.infer<typeof RemixBeyondSaveV1Schema>;

export type DecodeRemixBeyondSaveResult =
  | { readonly status: "valid"; readonly save: RemixBeyondSaveV1 }
  | { readonly status: "invalidJson"; readonly message: string }
  | { readonly status: "unsupportedVersion"; readonly version: unknown }
  | {
      readonly status: "invalidSchema";
      readonly issues: readonly {
        readonly path: string;
        readonly message: string;
      }[];
    };

function toSaveDecimal(value: { toString(): string }): string {
  return value.toString();
}

/** Creates the versioned, platform-neutral envelope used by Beyond saves. */
export function createRemixBeyondSave(
  state: RemixLegacySaveApplicationState,
): RemixBeyondSaveV1 {
  const simulation = state.simulation;
  return RemixBeyondSaveV1Schema.parse({
    format: "idle-mine-beyond",
    version: REMIX_BEYOND_SAVE_VERSION,
    state: {
      simulation: {
        mineObjectLevel: simulation.mineObjectLevel,
        highestMineObjectLevel: simulation.highestMineObjectLevel,
        resources: Object.fromEntries(
          Object.entries(simulation.resources).map(([key, value]) => [
            key,
            toSaveDecimal(value),
          ]),
        ),
        powers: Object.fromEntries(
          Object.entries(simulation.powers).map(([key, value]) => [
            key,
            toSaveDecimal(value),
          ]),
        ),
        pickaxe: {
          name: simulation.pickaxe.name,
          power: toSaveDecimal(simulation.pickaxe.power),
          quality: toSaveDecimal(simulation.pickaxe.quality),
        },
        upgrades: simulation.upgrades,
        autoPickaxeTimer: simulation.autoPickaxeTimer,
        saveTimer: simulation.saveTimer,
        powersUnlocked: simulation.powersUnlocked,
        usedGemsLevel: simulation.usedGemsLevel,
        ...(simulation.lastActiveMs === undefined
          ? {}
          : { lastActiveMs: simulation.lastActiveMs }),
        story: simulation.story,
      },
      storyScrollY: state.storyScrollY,
      settings: state.settings,
      powerValueExtras: state.powerValueExtras.map(toSaveDecimal),
    },
  });
}

/** Serializes a validated v1 snapshot as a JSON string. */
export function encodeRemixBeyondSave(
  state: RemixLegacySaveApplicationState,
): string {
  return JSON.stringify(createRemixBeyondSave(state));
}

/** Parses JSON and validates its explicit format version and complete shape. */
export function decodeRemixBeyondSave(
  serialized: string,
): DecodeRemixBeyondSaveResult {
  let value: unknown;
  try {
    value = JSON.parse(serialized) as unknown;
  } catch (error) {
    return {
      status: "invalidJson",
      message: error instanceof Error ? error.message : String(error),
    };
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    value.version !== REMIX_BEYOND_SAVE_VERSION
  ) {
    return { status: "unsupportedVersion", version: value.version };
  }

  const parsed = RemixBeyondSaveV1Schema.safeParse(value);
  if (!parsed.success) {
    return {
      status: "invalidSchema",
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.map(String).join("."),
        message: issue.message,
      })),
    };
  }
  return { status: "valid", save: parsed.data };
}

/** Rehydrates Decimals and derives the current mine object from its saved ID. */
export function restoreRemixBeyondSave(
  save: RemixBeyondSaveV1,
  catalog: RemixMineObjectCatalog,
): RemixLegacySaveApplicationState {
  const { state } = save;
  const persisted = state.simulation;
  const simulation = {
    mineObjectLevel: persisted.mineObjectLevel,
    highestMineObjectLevel: persisted.highestMineObjectLevel,
    currentObject: getRemixMineObject(persisted.mineObjectLevel, catalog),
    resources: Object.fromEntries(
      Object.entries(persisted.resources).map(([key, value]) => [
        key,
        new Decimal(value),
      ]),
    ) as RemixLegacySaveApplicationState["simulation"]["resources"],
    powers: Object.fromEntries(
      Object.entries(persisted.powers).map(([key, value]) => [
        key,
        new Decimal(value),
      ]),
    ) as RemixLegacySaveApplicationState["simulation"]["powers"],
    pickaxe: {
      name: persisted.pickaxe.name,
      power: new Decimal(persisted.pickaxe.power),
      quality: new Decimal(persisted.pickaxe.quality),
    },
    upgrades: {
      money: { ...persisted.upgrades.money },
      gems: { ...persisted.upgrades.gems },
      planetCoins: { ...persisted.upgrades.planetCoins },
      wisdom: { ...persisted.upgrades.wisdom },
    },
    autoPickaxeTimer: persisted.autoPickaxeTimer,
    saveTimer: persisted.saveTimer,
    powersUnlocked: persisted.highestMineObjectLevel >= 170,
    usedGemsLevel: persisted.usedGemsLevel,
    ...(persisted.lastActiveMs === undefined
      ? {}
      : { lastActiveMs: persisted.lastActiveMs }),
    story: { ...persisted.story },
  } satisfies RemixLegacySaveApplicationState["simulation"];

  return {
    simulation,
    storyScrollY: state.storyScrollY,
    settings: { ...state.settings },
    powerValueExtras: state.powerValueExtras.map((value) => new Decimal(value)),
  };
}
