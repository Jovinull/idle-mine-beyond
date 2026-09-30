import milestoneContent from "@idle-mine-beyond/content/remix-story-milestones";
import templateContent from "@idle-mine-beyond/content/remix-story-template";
import {
  Decimal,
  formatRemixStoryObjectiveText,
  type DecimalSource,
  type RemixStoryMilestone,
} from "@idle-mine-beyond/core";
import {
  formatThousands,
  type NotationFormatter,
} from "@idle-mine-beyond/formatting";
import { renderRemixStoryTemplate } from "$game/remix-story-template";

export const chapters: readonly string[] = templateContent.chapters;
export const milestones =
  milestoneContent.milestones as unknown as RemixStoryMilestone[];

export function chapterSlug(page: number): string {
  return `chapter-${page + 1}`;
}

export function pageFromSlug(slug: string): number | undefined {
  const match = /^chapter-(\d+)$/.exec(slug);
  const page = match ? Number(match[1]) - 1 : -1;
  return page >= 0 && page < chapters.length ? page : undefined;
}

export function chapterMilestones(page: number): RemixStoryMilestone[] {
  return milestones.filter((milestone) => milestone.page === page);
}

/** Story captions shown under object previews, keyed by object level. */
export type StoryQuote = {
  key: string;
  page: number;
  level: number;
  caption: string;
};

function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function readQuotes(): StoryQuote[] {
  const pageOf = new Map(milestones.map((m) => [m.key, m.page]));
  const { template, blocks } = templateContent;
  const quotes: StoryQuote[] = [];
  for (const block of blocks) {
    let text = template.slice(
      block.templateOffsets.start,
      block.templateOffsets.end,
    );
    // Nested blocks are read on their own; drop them from the parent's text.
    for (const child of blocks) {
      if (child.conditionalAncestors.at(-1) === block.key) {
        text = text.replace(
          template.slice(
            child.templateOffsets.start,
            child.templateOffsets.end,
          ),
          "",
        );
      }
    }
    const pattern =
      /<mine-object :level="(\d+)"[^>]*><\/mine-object>\s*<span>([\s\S]*?)<\/span>/g;
    for (const match of text.matchAll(pattern)) {
      quotes.push({
        key: block.key,
        page: pageOf.get(block.key) ?? 0,
        level: Number(match[1]),
        caption: stripTags(match[2] ?? ""),
      });
    }
  }
  return quotes;
}

export const storyQuotes: readonly StoryQuote[] = readQuotes();

/** Story chapter in which the player first reaches object `level`. */
export function chapterForLevel(level: number): number {
  let page = 0;
  let best = -1;
  for (const milestone of milestones) {
    const { condition } = milestone;
    if (
      condition.kind === "highestMineObjectLevelAtLeast" &&
      condition.level <= level &&
      condition.level > best
    ) {
      best = condition.level;
      page = milestone.page;
    }
  }
  return page;
}

/** The objective the game shows while this milestone is the next one. */
export function objectiveText(
  milestone: RemixStoryMilestone,
  formatter: NotationFormatter,
): string {
  const level =
    milestone.condition.kind === "highestMineObjectLevelAtLeast"
      ? milestone.condition.level
      : 1;
  return formatRemixStoryObjectiveText(
    milestone.objective,
    {
      highestMineObjectLevel: level - 1,
      highestMoney: 0,
      maxPlanetCoins: 0,
      moneyUpgradeLevels: {},
      wisdomUpgradeLevels: {},
    },
    {
      formatThousands: (value: DecimalSource) =>
        formatThousands(value, formatter),
      formatSelectedNotation: (value: DecimalSource) => formatter.format(value),
    },
  );
}

/**
 * The chapter's narrative exactly as the game renders it with every milestone
 * of the chapter unlocked, minus the page controls and objective line.
 */
export function chapterHtml(
  page: number,
  formatter: NotationFormatter,
): string {
  const html = renderRemixStoryTemplate(templateContent, {
    page,
    maximumPage: chapters.length - 1,
    displayedKeys: new Set(chapterMilestones(page).map((m) => m.key)),
    objectiveText: null,
    longGoal1: formatter.format(new Decimal(2).pow(1024)),
    longGoal2: formatter.format(new Decimal(2).pow(4096)),
    formatThousands: (value, limit) =>
      formatThousands(value, formatter, limit ?? "1e12"),
    formatSelectedNotation: (value) => formatter.format(value),
  });
  const open = html.indexOf('<div class="story-milestones"');
  const start = html.indexOf(">", open) + 1;
  const end = html.lastIndexOf("</div>", html.lastIndexOf("</article>"));
  if (open < 0 || start <= 0 || end <= start) {
    throw new Error(`Could not read Story chapter ${page + 1}.`);
  }
  return html
    .slice(start, end)
    .replace(
      /<button data-story-action="payUSDebt"[^>]*>([\s\S]*?)<\/button>/g,
      '<span class="story-button">$1</span>',
    );
}
