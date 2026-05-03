export class ConcurrencyError extends Error {
  constructor(
    aggregateId: string,
    aggregateType: string,
    expectedVersion: number,
    actualVersion: number,
  ) {
    super(
      `イベントストリームの version が競合しました: ${aggregateType}/${aggregateId} expected=${expectedVersion} actual=${actualVersion}`,
    );
    this.name = "ConcurrencyError";
  }
}
