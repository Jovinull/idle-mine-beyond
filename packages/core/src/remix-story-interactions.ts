import { Decimal, type DecimalSource } from "./decimal.js";

export type RemixStoryInteractionEffect =
  | { type: "alert"; message: string }
  | { type: "logMessage"; message: string; color: string };

export type RemixStoryThousandsFormatter = (
  value: DecimalSource,
  limit: DecimalSource,
) => string;

const US_DEBT = "22000000000000";
const UNABLE_TO_AFFORD = "You can't afford to pay off the debt right now.";
const STORY_JOKE =
  "You really tried. But then you noticed that it's just a game.";
const STORY_ERROR =
  "ERROR: Exception occurred while paying off US National debt: game money couldn't be converted to USD";
const REMIX_ERROR_COLOR = "#ff0900";

export function attemptRemixPayUSDebt(
  money: DecimalSource,
): RemixStoryInteractionEffect[] {
  if (new Decimal(money).lt(US_DEBT)) {
    return [{ type: "alert", message: UNABLE_TO_AFFORD }];
  }

  return [
    { type: "alert", message: STORY_JOKE },
    { type: "logMessage", message: STORY_ERROR, color: REMIX_ERROR_COLOR },
  ];
}

export function getRemixPayUSDebtButtonLabel(
  formatThousands: RemixStoryThousandsFormatter,
): string {
  return `PAY ($ ${formatThousands(US_DEBT, "1e100")})`;
}
