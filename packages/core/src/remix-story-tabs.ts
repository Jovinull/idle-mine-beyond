export interface RemixStoryTabState {
  readonly tab: string;
  readonly scrollY: number;
  readonly notifications: number;
}

export interface RemixStoryTabInput {
  readonly currentTab: string;
  readonly targetTab: string;
  readonly currentScrollTop: number;
  readonly scrollY: number;
  readonly notifications: number;
}

export type RemixStoryTabEffect =
  | {
      readonly type: "restore-story-scroll";
      readonly delayMs: 30;
      readonly scrollY: number;
    }
  | { readonly type: "refresh-number-select"; readonly delayMs: 50 };

export interface RemixStoryTabTransition {
  readonly state: RemixStoryTabState;
  readonly effects: readonly RemixStoryTabEffect[];
}

export function transitionRemixStoryTab(
  input: RemixStoryTabInput,
): RemixStoryTabTransition {
  const scrollY =
    input.currentTab === "story" ? input.currentScrollTop : input.scrollY;
  const notifications = input.targetTab === "story" ? 0 : input.notifications;
  const effects: RemixStoryTabEffect[] = [];

  if (input.targetTab === "story") {
    effects.push({ type: "restore-story-scroll", delayMs: 30, scrollY });
  }
  if (input.targetTab === "settings") {
    effects.push({ type: "refresh-number-select", delayMs: 50 });
  }

  return {
    state: { tab: input.targetTab, scrollY, notifications },
    effects,
  };
}
