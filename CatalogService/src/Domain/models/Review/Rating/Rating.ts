import { isEqual } from "lodash";

export class Rating {
  private readonly _value: number;

  static readonly MAX = 5;
  static readonly MIN = 1;

  constructor(value: number) {
    this.validate(value);
    this._value = value;
  }

  protected validate(value: number): void {
    if (!Number.isInteger(value)) {
      throw new Error("評価は整数値でなければなりません。");
    }
  }

  equals(other: Rating): boolean {
    return isEqual(this._value, other._value);
  }

  get value(): number {
    return this._value;
  }

  /**
   * 評価の品質係数を返す (0.0 〜 1.0の範囲)
   */
  getQualityFactor(): number {
    return (this._value - Rating.MIN) / (Rating.MAX - Rating.MIN);
  }
}
