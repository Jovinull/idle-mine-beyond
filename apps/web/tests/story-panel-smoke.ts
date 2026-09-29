import { mount, tick, unmount } from "svelte";
import type { RemixStoryConditionState } from "@idle-mine-beyond/core";
import StoryPanel from "../src/lib/StoryPanel.svelte";

type Scenario = {
  conditionState: RemixStoryConditionState;
  page: number;
};

const output = document.querySelector<HTMLPreElement>("#result");
if (!output) throw new Error("Story panel probe failed to initialize.");
document.body.style.margin = "0";
output.hidden = true;

const host = document.createElement("div");
host.id = "story-panel-host";
document.body.append(host);

let component: ReturnType<typeof mount> | undefined;
const browserWindow = window as Window & {
  __idleMineStoryPanelConfigure?: (scenario: Scenario) => Promise<void>;
};

browserWindow.__idleMineStoryPanelConfigure = async ({
  conditionState,
  page,
}) => {
  if (component) await unmount(component);
  host.replaceChildren();
  component = mount(StoryPanel, {
    target: host,
    props: { conditionState, page },
  });
  await tick();

  const deadline = performance.now() + 5000;
  while (performance.now() < deadline) {
    const canvases = [
      ...host.querySelectorAll<HTMLCanvasElement>("canvas.mine-object"),
    ];
    if (canvases.every((canvas) => canvas.dataset.rendered === "true")) return;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  const pending = [
    ...host.querySelectorAll<HTMLCanvasElement>("canvas.mine-object"),
  ]
    .filter((canvas) => canvas.dataset.rendered !== "true")
    .map((canvas) => canvas.dataset.level);
  throw new Error(
    `Story mine-object previews did not render: ${pending.join(", ")}`,
  );
};

output.textContent = "Story panel probe ready";
output.dataset.ready = "true";
