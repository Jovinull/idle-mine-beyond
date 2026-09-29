import { existsSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

function findInstalledChrome() {
  const candidates =
    process.platform === "win32"
      ? [
          process.env.ProgramFiles,
          process.env["ProgramFiles(x86)"],
          process.env.LOCALAPPDATA,
        ]
          .filter(Boolean)
          .map((root) =>
            join(root, "Google", "Chrome", "Application", "chrome.exe"),
          )
      : process.platform === "darwin"
        ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
        : [
            "/usr/bin/google-chrome",
            "/usr/bin/google-chrome-stable",
            "/usr/bin/chromium",
            "/usr/bin/chromium-browser",
          ];

  return candidates.find((candidate) => existsSync(candidate));
}

// Linux Chromium hints glyphs to whole pixels by default, while Windows uses
// subpixel text positioning. Disabling hinting keeps captured text widths and
// line wrapping identical across capture platforms.
const args = ["--font-render-hinting=none"];

export function getChromiumLaunchOptions() {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  if (executablePath) return { args, executablePath };

  if (process.env.CI || existsSync(chromium.executablePath())) return { args };

  const installedChrome = findInstalledChrome();
  if (installedChrome) return { args, executablePath: installedChrome };

  return { args, channel: "chrome" };
}
