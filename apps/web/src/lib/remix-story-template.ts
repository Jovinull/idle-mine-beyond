export interface RemixStoryTemplateBlock {
  sourceOrder: number;
  key: string;
  occurrence: number;
  conditionalAncestors: string[];
  templateOffsets: { start: number; end: number };
}

export interface RemixStoryTemplateContent {
  chapters: string[];
  template: string;
  blocks: RemixStoryTemplateBlock[];
}

export interface RemixStoryTemplateValues {
  page: number;
  maximumPage: number;
  displayedKeys: ReadonlySet<string>;
  objectiveText: string | null;
  longGoal1: string;
  longGoal2: string;
  formatThousands(value: DecimalSource, limit?: DecimalSource): string;
  formatSelectedNotation(value: DecimalSource): string;
}

const closeDiv = "</div>";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function groupBlocksByParent(
  blocks: readonly RemixStoryTemplateBlock[],
): Map<string | null, RemixStoryTemplateBlock[]> {
  const groups = new Map<string | null, RemixStoryTemplateBlock[]>();
  for (const block of blocks) {
    const parent = block.conditionalAncestors.at(-1) ?? null;
    const group = groups.get(parent) ?? [];
    group.push(block);
    groups.set(parent, group);
  }
  for (const group of groups.values()) {
    group.sort(
      (left, right) => left.templateOffsets.start - right.templateOffsets.start,
    );
  }
  return groups;
}

function renderConditionalBlocks(
  source: string,
  start: number,
  end: number,
  parent: string | null,
  groups: ReadonlyMap<string | null, readonly RemixStoryTemplateBlock[]>,
  displayedKeys: ReadonlySet<string>,
): string {
  let cursor = start;
  let output = "";
  for (const block of groups.get(parent) ?? []) {
    const { start: blockStart, end: blockEnd } = block.templateOffsets;
    if (blockStart < cursor || blockEnd > end || blockEnd <= blockStart) {
      throw new Error(`Invalid source offsets for Story block ${block.key}.`);
    }
    output += source.slice(cursor, blockStart);
    cursor = blockEnd;
    if (!displayedKeys.has(block.key)) continue;

    const openingEnd = source.indexOf(">", blockStart);
    if (openingEnd < 0 || openingEnd >= blockEnd) {
      throw new Error(`Missing opening tag for Story block ${block.key}.`);
    }
    const openingTag = source.slice(blockStart, openingEnd + 1);
    const sourceCondition = ` v-if="storyDisplayed('${block.key}')"`;
    if (!openingTag.includes(sourceCondition)) {
      throw new Error(
        `Pinned Story block ${block.key} no longer has its recorded condition.`,
      );
    }
    const closeStart = blockEnd - closeDiv.length;
    if (source.slice(closeStart, blockEnd) !== closeDiv) {
      throw new Error(`Unexpected wrapper for Story block ${block.key}.`);
    }
    const safeKey = escapeHtml(block.key);
    output += `${openingTag.replace(sourceCondition, "").replace(/>$/, ` data-story-milestone-key="${safeKey}">`)}${renderConditionalBlocks(source, openingEnd + 1, closeStart, block.key, groups, displayedKeys)}${closeDiv}`;
  }
  output += source.slice(cursor, end);
  return output;
}

export function renderRemixStoryTemplate(
  content: RemixStoryTemplateContent,
  values: RemixStoryTemplateValues,
): string {
  const groups = groupBlocksByParent(content.blocks);
  let html = renderConditionalBlocks(
    content.template,
    0,
    content.template.length,
    null,
    groups,
    values.displayedKeys,
  );

  html = html.replace(" v-if=\"settings.tab === 'story'\"", "");
  html = html.replace(/\s+ref="storymilestones"/, "");
  html = html.replace(
    /<img v-if="story\.page > 0"([^>]*?)\/>/,
    values.page > 0 ? "<img$1/>" : "",
  );
  html = html.replace(
    /<img v-if="story\.page < getMaxStoryPage\(\)"([^>]*?)\/>/,
    values.page < values.maximumPage ? "<img$1/>" : "",
  );

  if (values.objectiveText === null) {
    html = html.replace(
      /<p v-if="getNextStoryText\(\) !== null" class="objective">[\s\S]*?<\/p>/,
      "",
    );
  } else {
    html = html.replace(
      '<p v-if="getNextStoryText() !== null" class="objective">',
      '<p class="objective">',
    );
  }

  const chapter = content.chapters[values.page] ?? "";
  const interpolations = new Map<string, string>([
    ["story.page + 1", String(values.page + 1)],
    ["story.chapters[story.page]", chapter],
    ["formatThousands(14000)", values.formatThousands(14000)],
    ["formatThousands(22e12, 1e100)", values.formatThousands(22e12, 1e100)],
    ["numberFormatter.format(150e30)", values.formatSelectedNotation("150e30")],
    ["numberFormatter.format(story.longGoal1)", values.longGoal1],
    ["numberFormatter.format(story.longGoal2)", values.longGoal2],
    ["getNextStoryText()", values.objectiveText ?? ""],
  ]);
  html = html.replace(/\{\{([\s\S]*?)\}\}/g, (_match, expression: string) => {
    const value = interpolations.get(expression.trim());
    if (value === undefined) {
      throw new Error(`Unsupported Remix Story interpolation: ${expression}`);
    }
    return escapeHtml(value);
  });

  html = html.replaceAll(
    '@click="decreaseStoryPage"',
    'data-story-action="decreaseStoryPage"',
  );
  html = html.replaceAll(
    '@click="increaseStoryPage"',
    'data-story-action="increaseStoryPage"',
  );
  html = html.replaceAll(
    '@click="payUSDebt()"',
    'data-story-action="payUSDebt"',
  );
  html = html.replaceAll('src="Images/', 'src="/Images/');
  html = html.replace(
    /<mine-object\b([^>]*)><\/mine-object>/g,
    (_match, attributes: string) => {
      const level = attributes.match(/:level="(\d+)"/)?.[1];
      const nodamage = attributes.match(/:nodamage="(true|false)"/)?.[1];
      if (level === undefined || nodamage !== "true") {
        throw new Error(
          "Unexpected mine-object attributes in the pinned Story.",
        );
      }
      return `<canvas width="256" height="224" class="mine-object nodmg" data-level="${level}" data-rendered="false"></canvas>`;
    },
  );

  if (/\bv-if=|\bv-[\w-]+=|@click=|\{\{/.test(html)) {
    throw new Error("Untranslated Vue syntax remains in the rendered Story.");
  }
  return html;
}
import type { DecimalSource } from "@idle-mine-beyond/core";
