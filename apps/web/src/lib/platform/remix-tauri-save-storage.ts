import type { RemixBeyondSaveStorageAdapter } from "@idle-mine-beyond/persistence";

export type RemixTauriInvoke = (
  command: string,
  args?: Record<string, unknown>,
) => Promise<unknown>;

export interface RemixTauriWindow {
  readonly __TAURI__?: {
    readonly core?: {
      readonly invoke?: RemixTauriInvoke;
    };
  };
}

/** Returns the documented Tauri global bridge when running inside its webview. */
export function getRemixTauriInvoke(
  target: RemixTauriWindow,
): RemixTauriInvoke | undefined {
  return target.__TAURI__?.core?.invoke;
}

async function invokeResult<T>(
  invoke: RemixTauriInvoke,
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  return (await invoke(command, args)) as T;
}

/** Stores the two Beyond save slots through the native Tauri persistence port. */
export function createTauriRemixSaveStorage(
  invoke: RemixTauriInvoke,
): RemixBeyondSaveStorageAdapter {
  return {
    readPrimary: () =>
      invokeResult<string | null>(invoke, "read_remix_save_slot", {
        slot: "primary",
      }),
    writePrimary: async (serialized) => {
      await invoke("write_remix_save_slot", {
        slot: "primary",
        serialized,
      });
    },
    readBackup: () =>
      invokeResult<string | null>(invoke, "read_remix_save_slot", {
        slot: "backup",
      }),
    writeBackup: async (serialized) => {
      await invoke("write_remix_save_slot", {
        slot: "backup",
        serialized,
      });
    },
  };
}

/** Removes only Beyond's known save slots and temporary files. */
export async function clearTauriRemixSaveStorage(
  invoke: RemixTauriInvoke,
): Promise<void> {
  await invoke("clear_remix_save_slots");
}
