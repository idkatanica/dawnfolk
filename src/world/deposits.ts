import type { DepositKind } from "../content/deposits.ts";

export interface Deposit {
  readonly cells: readonly number[];
  readonly id: number;
  readonly kind: DepositKind;
  readonly x: number;
  readonly z: number;
}
