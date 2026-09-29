export interface StoryMarkupBlock {
  sourceOrder: number;
  key: string;
  occurrence: number;
  conditionalAncestors: string[];
  conditionExpression: string | null;
  templateOffsets: { start: number; end: number };
  embeddedMineObjectAttributes: string[];
  imageSources: string[];
}

export interface ExtractedStoryArticle {
  template: string;
  blocks: StoryMarkupBlock[];
}

export function extractStoryArticle(source: string): ExtractedStoryArticle;
