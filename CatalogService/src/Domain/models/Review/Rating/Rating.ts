import { isEqual } from "lodash";

export class Rating {
    private readonly _value: number;

    constructor(value: number) {
        this._value = value;
    }

    equals(other: Rating): boolean {
        return isEqual(this._value, other._value);
    }

    get value(): number {
        return this._value;
    }
}