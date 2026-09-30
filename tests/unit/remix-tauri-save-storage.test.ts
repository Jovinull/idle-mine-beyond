import { describe, expect, it, vi } from "vitest";
import {
  clearTauriRemixSaveStorage,
  createTauriRemixSaveStorage,
  getRemixTauriInvoke,
  type RemixTauriInvoke,
} from "../../apps/web/src/lib/platform/remix-tauri-save-storage.js";

describe("Tauri save-storage adapter", () => {
  it("maps primary and backup reads and writes to the restricted native slots", async () => {
    const invoke = vi.fn<RemixTauriInvoke>(async (command, args) => {
      if (command === "read_remix_save_slot")
        return `${String(args?.["slot"])}-save`;
      return undefined;
    });
    const storage = createTauriRemixSaveStorage(invoke);

    await expect(storage.readPrimary()).resolves.toBe("primary-save");
    await expect(storage.readBackup()).resolves.toBe("backup-save");
    await storage.writePrimary("encoded-primary");
    await storage.writeBackup("encoded-backup");

    expect(invoke.mock.calls).toEqual([
      ["read_remix_save_slot", { slot: "primary" }],
      ["read_remix_save_slot", { slot: "backup" }],
      [
        "write_remix_save_slot",
        { slot: "primary", serialized: "encoded-primary" },
      ],
      [
        "write_remix_save_slot",
        { slot: "backup", serialized: "encoded-backup" },
      ],
    ]);
  });

  it("uses the Tauri core global and clears only native save slots", async () => {
    const invoke = vi.fn<RemixTauriInvoke>(async () => undefined);
    expect(getRemixTauriInvoke({ __TAURI__: { core: { invoke } } })).toBe(
      invoke,
    );
    expect(getRemixTauriInvoke({})).toBeUndefined();

    await clearTauriRemixSaveStorage(invoke);

    expect(invoke).toHaveBeenCalledExactlyOnceWith("clear_remix_save_slots");
  });
});
