const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const BASE64_VALUES = new Map(
  [...BASE64_ALPHABET].map((character, value) => [character, value]),
);

export interface RemixLegacySaveCodecError {
  readonly name: string;
  readonly message: string;
}

export interface RemixLegacySaveDecodeEffect {
  readonly type: "alertDecodeError";
}

export type RemixLegacySaveDecodeResult =
  | {
      readonly status: "success";
      readonly json: string;
      readonly value: unknown;
      readonly effects: readonly [];
    }
  | {
      readonly status: "invalidEncoding";
      readonly decodeError: RemixLegacySaveCodecError;
      readonly parseError: RemixLegacySaveCodecError;
      readonly effects: readonly [RemixLegacySaveDecodeEffect];
    }
  | {
      readonly status: "invalidJson";
      readonly json: string;
      readonly parseError: RemixLegacySaveCodecError;
      readonly effects: readonly [];
    };

class InvalidBase64Error extends Error {
  override name = "InvalidCharacterError";

  constructor() {
    super(
      "Failed to execute 'atob' on 'Window': The string to be decoded is not correctly encoded.",
    );
  }
}

function decodeBase64Binary(input: string): string {
  const source = input.replace(/[\t\n\f\r ]/g, "");
  const firstPadding = source.indexOf("=");
  const data = firstPadding < 0 ? source : source.slice(0, firstPadding);
  const padding = firstPadding < 0 ? 0 : source.length - firstPadding;
  const remainder = data.length % 4;

  if (
    padding > 2 ||
    (firstPadding >= 0 && source.length % 4 !== 0) ||
    (padding === 1 && remainder !== 3) ||
    (padding === 2 && remainder !== 2) ||
    (padding === 0 && remainder === 1) ||
    !/^[A-Za-z0-9+/]*$/.test(data) ||
    (firstPadding >= 0 && !/^={0,2}$/.test(source.slice(firstPadding)))
  ) {
    throw new InvalidBase64Error();
  }

  const bytes: number[] = [];
  for (let index = 0; index < data.length; index += 4) {
    const first = BASE64_VALUES.get(data[index] ?? "");
    const second = BASE64_VALUES.get(data[index + 1] ?? "");
    const third = data[index + 2]
      ? BASE64_VALUES.get(data[index + 2] ?? "")
      : undefined;
    const fourth = data[index + 3]
      ? BASE64_VALUES.get(data[index + 3] ?? "")
      : undefined;

    if (first === undefined || second === undefined) {
      throw new InvalidBase64Error();
    }

    bytes.push((first << 2) | (second >> 4));
    if (third !== undefined) {
      bytes.push(((second & 0x0f) << 4) | (third >> 2));
    }
    if (fourth !== undefined && third !== undefined) {
      bytes.push(((third & 0x03) << 6) | fourth);
    }
  }

  let binary = "";
  const chunkSize = 0x4000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
  }
  return binary;
}

function legacyUnescape(input: string): string {
  return input.replace(
    /%u([0-9a-fA-F]{4})|%([0-9a-fA-F]{2})/g,
    (_, wide, byte) => String.fromCharCode(Number.parseInt(wide ?? byte, 16)),
  );
}

function toCodecError(error: unknown): RemixLegacySaveCodecError {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return { name: "Error", message: String(error) };
}

function parseJson(
  json: string | undefined,
):
  | { readonly success: true; readonly value: unknown }
  | { readonly success: false; readonly error: RemixLegacySaveCodecError } {
  try {
    return { success: true, value: JSON.parse(json as string) as unknown };
  } catch (error) {
    return { success: false, error: toCodecError(error) };
  }
}

function parseUndefinedError(): RemixLegacySaveCodecError {
  try {
    JSON.parse(undefined as unknown as string);
  } catch (error) {
    return toCodecError(error);
  }
  return { name: "SyntaxError", message: "" };
}

/**
 * Decodes the pinned Remix save wrapper, including its observable
 * decodeURIComponent-then-unescape Unicode behavior.
 */
export function decodeRemixLegacySave(
  saveString: string,
): RemixLegacySaveDecodeResult {
  let json: string;
  try {
    json = legacyUnescape(decodeURIComponent(decodeBase64Binary(saveString)));
  } catch (error) {
    const decodeError = toCodecError(error);
    return {
      status: "invalidEncoding",
      decodeError,
      parseError: parseUndefinedError(),
      effects: [{ type: "alertDecodeError" }],
    };
  }

  const parsed = parseJson(json);
  if (!parsed.success) {
    return {
      status: "invalidJson",
      json,
      parseError: parsed.error,
      effects: [],
    };
  }

  return { status: "success", json, value: parsed.value, effects: [] };
}

function legacyEscape(input: string): string {
  let escaped = "";
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index] ?? "";
    if (/[A-Za-z0-9@*_+./-]/.test(character)) {
      escaped += character;
      continue;
    }

    const code = character.charCodeAt(0);
    escaped +=
      code < 256
        ? `%${code.toString(16).padStart(2, "0").toUpperCase()}`
        : `%u${code.toString(16).padStart(4, "0").toUpperCase()}`;
  }
  return escaped;
}

function encodeBase64Ascii(input: string): string {
  let encoded = "";
  for (let index = 0; index < input.length; index += 3) {
    const first = input.charCodeAt(index);
    const hasSecond = index + 1 < input.length;
    const hasThird = index + 2 < input.length;
    const second = hasSecond ? input.charCodeAt(index + 1) : 0;
    const third = hasThird ? input.charCodeAt(index + 2) : 0;
    if (first > 0x7f || second > 0x7f || third > 0x7f) {
      throw new TypeError("Remix save wrapper must encode ASCII bytes.");
    }

    encoded += BASE64_ALPHABET[first >> 2];
    encoded += BASE64_ALPHABET[((first & 0x03) << 4) | (second >> 4)];
    encoded += hasSecond
      ? BASE64_ALPHABET[((second & 0x0f) << 2) | (third >> 6)]
      : "=";
    encoded += hasThird ? BASE64_ALPHABET[third & 0x3f] : "=";
  }
  return encoded;
}

/** Encodes JSON with Remix's legacy encodeURIComponent → escape → btoa order. */
export function encodeRemixLegacySave(value: object): string {
  const json = JSON.stringify(value);
  if (json === undefined) {
    throw new TypeError("Remix save value did not serialize to JSON.");
  }
  return encodeBase64Ascii(legacyEscape(encodeURIComponent(json)));
}
