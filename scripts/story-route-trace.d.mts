export declare const compactCheckpointInterval: number;

export declare function canonicalJson(value: unknown): string;

export declare function chainStoryRouteCheckpoint(
  previousChain: string,
  checkpoint: unknown,
): string;

export declare function isRepeatedStoryRouteEvent(event: {
  type: string;
  purpose?: string;
}): boolean;

export declare function compactStoryRouteRecords<
  TRecord extends { event: unknown; checkpoint: unknown },
>(
  records: AsyncIterable<TRecord> | Iterable<TRecord>,
): AsyncGenerator<
  | { event: TRecord["event"] }
  | {
      event: TRecord["event"];
      checkpoint: TRecord["checkpoint"];
      chain: string;
    }
>;
