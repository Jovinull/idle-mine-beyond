import { z } from "zod";
import {
  decodeRemixBeyondSave,
  type DecodeRemixBeyondSaveResult,
  type RemixBeyondSaveV1,
} from "./remix-beyond-save.js";

const recoveryBundleSchema = z
  .object({
    format: z.literal("idle-mine-beyond-recovery"),
    version: z.literal(1),
    saves: z
      .object({
        beyondPrimary: z.string().nullable(),
        beyondBackup: z.string().nullable(),
        remixLegacy: z.string().nullable(),
      })
      .strict(),
  })
  .strict();

export type RemixBeyondRecoveryFileSource = "direct" | "primary" | "backup";

export type DecodeRemixBeyondRecoveryFileResult =
  | {
      readonly status: "valid";
      readonly source: RemixBeyondRecoveryFileSource;
      readonly save: RemixBeyondSaveV1;
    }
  | {
      readonly status: "unsupportedVersion";
      readonly source: RemixBeyondRecoveryFileSource | "bundle";
      readonly version: unknown;
    }
  | { readonly status: "empty" }
  | {
      readonly status: "invalid";
      readonly message: string;
      readonly primary?: Exclude<
        DecodeRemixBeyondSaveResult,
        { status: "valid" }
      > | null;
      readonly backup?: Exclude<
        DecodeRemixBeyondSaveResult,
        { status: "valid" }
      > | null;
    };

function decodeSaveSlot(
  serialized: string,
  source: "direct" | "primary" | "backup",
): DecodeRemixBeyondRecoveryFileResult {
  const decoded = decodeRemixBeyondSave(serialized);
  if (decoded.status === "valid") {
    return { status: "valid", source, save: decoded.save };
  }
  if (decoded.status === "unsupportedVersion") {
    return { status: "unsupportedVersion", source, version: decoded.version };
  }
  return {
    status: "invalid",
    message:
      decoded.status === "invalidJson"
        ? decoded.message
        : `Save in ${source} has an invalid schema.`,
    ...(source === "primary" ? { primary: decoded } : {}),
    ...(source === "backup" ? { backup: decoded } : {}),
  };
}

/**
 * Decodes either a standalone Beyond v1 save or the project's recovery bundle.
 * Bundle recovery prefers primary, then a valid backup; a future primary
 * version blocks fallback so importing cannot silently downgrade the save.
 * The Remix legacy slot is deliberately never treated as a Beyond save.
 */
export function decodeRemixBeyondRecoveryFile(
  serialized: string,
): DecodeRemixBeyondRecoveryFileResult {
  let value: unknown;
  try {
    value = JSON.parse(serialized) as unknown;
  } catch (error) {
    return {
      status: "invalid",
      message: error instanceof Error ? error.message : String(error),
    };
  }

  if (typeof value !== "object" || value === null || !("format" in value)) {
    return { status: "invalid", message: "Unknown recovery file format." };
  }

  if (value.format === "idle-mine-beyond") {
    return decodeSaveSlot(serialized, "direct");
  }

  if (value.format !== "idle-mine-beyond-recovery") {
    return { status: "invalid", message: "Unknown recovery file format." };
  }

  if (!("version" in value) || value.version !== 1) {
    return {
      status: "unsupportedVersion",
      source: "bundle",
      version: "version" in value ? value.version : undefined,
    };
  }

  const bundle = recoveryBundleSchema.safeParse(value);
  if (!bundle.success) {
    return {
      status: "invalid",
      message: `Recovery bundle has an invalid schema: ${bundle.error.issues
        .map((issue) => issue.path.map(String).join("."))
        .join(", ")}`,
    };
  }

  const { beyondPrimary, beyondBackup } = bundle.data.saves;
  let primaryFailure: Exclude<
    DecodeRemixBeyondSaveResult,
    { status: "valid" }
  > | null = null;
  if (beyondPrimary !== null) {
    const primary = decodeSaveSlot(beyondPrimary, "primary");
    if (primary.status === "valid" || primary.status === "unsupportedVersion") {
      return primary;
    }
    primaryFailure = "primary" in primary ? (primary.primary ?? null) : null;
  }

  let backupFailure: Exclude<
    DecodeRemixBeyondSaveResult,
    { status: "valid" }
  > | null = null;
  if (beyondBackup !== null) {
    const backup = decodeSaveSlot(beyondBackup, "backup");
    if (backup.status === "valid" || backup.status === "unsupportedVersion") {
      return backup;
    }
    backupFailure = "backup" in backup ? (backup.backup ?? null) : null;
  }

  if (beyondPrimary === null && beyondBackup === null) {
    return { status: "empty" };
  }

  return {
    status: "invalid",
    message: "No valid Beyond save was found in the recovery bundle.",
    primary: primaryFailure,
    backup: backupFailure,
  };
}
