import { Fn, float, floor, If, int, select, uint, vec3 } from "three/tsl";
import type { Node } from "three/webgpu";

const HASH_SEED = 0xde_ad_be_ef + 3 * 4 + 13;
const GRADIENT_SCALE = 0.982;
const CORNERS = [0, 1, 2, 3, 4, 5, 6, 7] as const;

function rotateLeft(value: Node<"uint">, bits: number): Node<"uint"> {
  return value.shiftLeft(uint(bits)).bitOr(value.shiftRight(uint(32 - bits)));
}

const latticeHash = Fn(([column, row, layer]: [Node<"int">, Node<"int">, Node<"int">]) => {
  const first = uint(HASH_SEED).add(uint(column)).toVar();
  const second = uint(HASH_SEED).add(uint(row)).toVar();
  const third = uint(HASH_SEED).add(uint(layer)).toVar();

  third.assign(third.bitXor(second).sub(rotateLeft(second, 14)));
  first.assign(first.bitXor(third).sub(rotateLeft(third, 11)));
  second.assign(second.bitXor(first).sub(rotateLeft(first, 25)));
  third.assign(third.bitXor(second).sub(rotateLeft(second, 16)));
  first.assign(first.bitXor(third).sub(rotateLeft(third, 4)));
  second.assign(second.bitXor(first).sub(rotateLeft(first, 14)));
  third.assign(third.bitXor(second).sub(rotateLeft(second, 24)));

  return third;
}).setLayout({
  inputs: [
    { name: "column", type: "int" },
    { name: "row", type: "int" },
    { name: "layer", type: "int" },
  ],
  name: "waveLatticeHash",
  type: "uint",
});

const gradientDot = Fn(([hash, x, y, z]: [Node<"uint">, Node<"float">, Node<"float">, Node<"float">]) => {
  const bits = hash.bitAnd(uint(15)).toVar();

  const along = select(bits.lessThan(uint(8)), x, y);
  const across = select(bits.lessThan(uint(4)), y, select(bits.equal(uint(12)).or(bits.equal(uint(14))), x, z));

  const signedAlong = select(bits.bitAnd(uint(1)).notEqual(uint(0)), along.negate(), along);
  const signedAcross = select(bits.bitAnd(uint(2)).notEqual(uint(0)), across.negate(), across);

  return signedAlong.add(signedAcross);
}).setLayout({
  inputs: [
    { name: "hash", type: "uint" },
    { name: "x", type: "float" },
    { name: "y", type: "float" },
    { name: "z", type: "float" },
  ],
  name: "waveGradientDot",
  type: "float",
});

const fade = Fn(([value]: [Node<"float">]) =>
  value
    .mul(value)
    .mul(value)
    .mul(value.mul(value.mul(6).sub(15)).add(10))
).setLayout({
  inputs: [{ name: "value", type: "float" }],
  name: "waveFade",
  type: "float",
});

function cornerHash(column: Node<"int">, row: Node<"int">, layer: Node<"int">, corner: number): Node<"uint"> {
  return latticeHash(
    column.add(int(corner % 2)),
    row.add(int(Math.floor(corner / 2) % 2)),
    layer.add(int(Math.floor(corner / 4)))
  );
}

function perlinFromHashes(
  hashes: readonly Node<"uint">[],
  x: Node<"float">,
  y: Node<"float">,
  z: Node<"float">
): Node<"float"> {
  const slopes = CORNERS.map((corner) =>
    gradientDot(
      hashes[corner],
      corner % 2 === 0 ? x : x.sub(1),
      Math.floor(corner / 2) % 2 === 0 ? y : y.sub(1),
      corner < 4 ? z : z.sub(1)
    )
  );

  const weightX = fade(x).toVar();
  const weightY = fade(y).toVar();
  const weightZ = fade(z).toVar();

  const keepX = float(1).sub(weightX).toVar();
  const keepY = float(1).sub(weightY).toVar();
  const keepZ = float(1).sub(weightZ).toVar();

  const near = keepY
    .mul(slopes[0].mul(keepX).add(slopes[1].mul(weightX)))
    .add(weightY.mul(slopes[2].mul(keepX).add(slopes[3].mul(weightX))));
  const far = keepY
    .mul(slopes[4].mul(keepX).add(slopes[5].mul(weightX)))
    .add(weightY.mul(slopes[6].mul(keepX).add(slopes[7].mul(weightX))));

  return keepZ.mul(near).add(weightZ.mul(far)).mul(GRADIENT_SCALE);
}

export const perlinWithSteps = Fn(
  ([point, step, frequency, layer]: [Node<"vec2">, Node<"float">, Node<"float">, Node<"float">]) => {
    const column = int(floor(point.x.mul(frequency))).toVar();
    const row = int(floor(point.y.mul(frequency))).toVar();
    const depth = int(floor(layer)).toVar();
    const eastColumn = int(floor(point.x.add(step).mul(frequency))).toVar();
    const southRow = int(floor(point.y.add(step).mul(frequency))).toVar();

    const center = CORNERS.map((corner) => cornerHash(column, row, depth, corner).toVar());
    const east = center.map((hash) => hash.toVar());
    const south = center.map((hash) => hash.toVar());

    If(eastColumn.notEqual(column), () => {
      for (const corner of [0, 2, 4, 6] as const) {
        east[corner].assign(center[corner + 1]);
        east[corner + 1].assign(cornerHash(eastColumn, row, depth, corner + 1));
      }
    });

    If(southRow.notEqual(row), () => {
      for (const corner of [0, 1, 4, 5] as const) {
        south[corner].assign(center[corner + 2]);
        south[corner + 2].assign(cornerHash(column, southRow, depth, corner + 2));
      }
    });

    const columnFraction = point.x.mul(frequency).sub(float(column));
    const rowFraction = point.y.mul(frequency).sub(float(row));
    const depthFraction = layer.sub(float(depth));

    return vec3(
      perlinFromHashes(center, columnFraction, rowFraction, depthFraction),
      perlinFromHashes(east, point.x.add(step).mul(frequency).sub(float(eastColumn)), rowFraction, depthFraction),
      perlinFromHashes(south, columnFraction, point.y.add(step).mul(frequency).sub(float(southRow)), depthFraction)
    );
  }
).setLayout({
  inputs: [
    { name: "point", type: "vec2" },
    { name: "step", type: "float" },
    { name: "frequency", type: "float" },
    { name: "layer", type: "float" },
  ],
  name: "wavePerlinWithSteps",
  type: "vec3",
});
