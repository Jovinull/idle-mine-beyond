import { REMIX_UPGRADE_KEYS } from "@idle-mine-beyond/core";

export interface RemixLegacyLoadError {
  readonly name: string;
  readonly message: string;
}

interface UpgradeSavePath {
  readonly savePath: readonly string[];
  readonly sourceTarget: string;
  readonly validKeys: readonly string[];
}

const upgradeSavePaths: readonly UpgradeSavePath[] = [
  {
    savePath: ["upgrades"],
    sourceTarget: "game.upgrades[k]",
    validKeys: REMIX_UPGRADE_KEYS.money,
  },
  {
    savePath: ["gemUpgrades"],
    sourceTarget: "game.gemUpgrades[k]",
    validKeys: REMIX_UPGRADE_KEYS.gems,
  },
  {
    savePath: ["planetCoinUpgrades"],
    sourceTarget: "game.planetCoinUpgrades[k]",
    validKeys: REMIX_UPGRADE_KEYS.planetCoins,
  },
  {
    savePath: ["powers", "upgrades"],
    sourceTarget: "game.powers.upgrades[k]",
    validKeys: REMIX_UPGRADE_KEYS.wisdom,
  },
];

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readPath(
  value: Record<string, unknown>,
  path: readonly string[],
): unknown {
  let current: unknown = value;
  for (const part of path) {
    const record = asRecord(current);
    if (record === undefined) return undefined;
    current = record[part];
  }
  return current;
}

function captureNativeTypeError(operation: () => unknown): string {
  try {
    operation();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return "";
}

function nativeUndefinedLevelAssignmentMessage(
  sourceTarget: string,
  sourceValue: string,
): string {
  const message = captureNativeTypeError(() => {
    const target: { level?: number } | undefined = undefined;
    target!.level = 0;
  });
  if (message.startsWith("can't access property")) {
    return `can't access property "level", ${sourceTarget} is undefined`;
  }
  if (message.startsWith("undefined is not an object")) {
    return `undefined is not an object (evaluating '${sourceTarget}.level = ${sourceValue}')`;
  }
  return message;
}

function nativeObjectKeysNullMessage(sourceExpression: string): string {
  const message = captureNativeTypeError(() => {
    Object.keys(null as unknown as object);
  });
  return message.replace(
    /Object\.keys\([^)]*\)/,
    `Object.keys(${sourceExpression})`,
  );
}

function nativeNullLevelReadMessage(sourceTarget: string): string {
  const message = captureNativeTypeError(() => {
    const target: { level?: number } | null = null;
    return target!.level;
  });
  if (message.startsWith("can't access property")) {
    return `can't access property "level", ${sourceTarget} is null`;
  }
  if (message.startsWith("null is not an object")) {
    return `null is not an object (evaluating '${sourceTarget}.level')`;
  }
  return message;
}

function formatNullRootError(message: string): string {
  return message
    .replace(
      /^(can't access property "money", )[A-Za-z_$][\w$]*( is null)$/,
      "$1loadObj$2",
    )
    .replace(
      /^null is not an object \(evaluating '[A-Za-z_$][\w$]*\[[A-Za-z_$][\w$]*\]'\)$/,
      "null is not an object (evaluating 'loadObj.money')",
    );
}

export function formatRemixLegacyLoadError(
  error: RemixLegacyLoadError,
  saveValue: unknown,
): RemixLegacyLoadError {
  if (error.name !== "TypeError") return error;

  const save = asRecord(saveValue);
  if (save === undefined) {
    return {
      ...error,
      message:
        saveValue === null ? formatNullRootError(error.message) : error.message,
    };
  }

  for (const path of upgradeSavePaths) {
    const group = readPath(save, path.savePath);
    if (group === null) {
      const sourceExpression = `loadObj.${path.savePath.join(".")}`;
      return {
        ...error,
        message: nativeObjectKeysNullMessage(sourceExpression),
      };
    }

    const entries = asRecord(group);
    if (entries === undefined) continue;
    if (
      error.message === "Cannot set properties of undefined (setting 'level')"
    ) {
      const unknownKey = Object.keys(entries).find(
        (key) => !path.validKeys.includes(key),
      );
      if (unknownKey !== undefined) {
        return {
          ...error,
          message: nativeUndefinedLevelAssignmentMessage(
            path.sourceTarget,
            `loadObj.${path.savePath.join(".")}[k].level`,
          ),
        };
      }
    }

    if (Object.values(entries).some((entry) => entry === null)) {
      const sourcePath = path.savePath.join(".");
      return {
        ...error,
        message: nativeNullLevelReadMessage(`loadObj.${sourcePath}[k]`),
      };
    }
  }

  return {
    ...error,
    message: error.message.replace(
      /\b[A-Za-z_$][\w$]*(?=\.(?:story|settings|upgrades|gemUpgrades|planetCoinUpgrades|powers|pickaxe)\b)/g,
      "loadObj",
    ),
  };
}
