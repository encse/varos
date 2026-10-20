import type { CityMap } from './types'

export type ParkKind = 'fountain' | 'woodland' | 'garden' | 'picnic'

/** Lavinahatású hash: szomszédos cellákból nem keletkeznek periodikus átlók. */
export function sceneryHash(seed: number, row: number, column: number): number {
  let value = seed ^ Math.imul(row + 1, 0x9e3779b1) ^ Math.imul(column + 1, 0x85ebca77)
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d)
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b)
  return (value ^ (value >>> 16)) >>> 0
}

/** A hely és típus városonként változik, újraindításkor viszont megmarad. */
export function planParks(map: CityMap): Map<string, ParkKind> {
  const seed = map.scenerySeed ?? sceneryHash(map.width, map.rows, map.columns)
  const blocks: Array<{ key: string; rank: number }> = []
  map.verticalLengths.forEach((height, row) => map.horizontalLengths.forEach((width, column) => {
    if (width >= 3.5 && height >= 3.5) blocks.push({ key: `${row}:${column}`, rank: sceneryHash(seed, row, column) })
  }))
  const kinds: ParkKind[] = ['fountain', 'woodland', 'garden', 'picnic']
  kinds.sort((a, b) => sceneryHash(seed, 71, a.charCodeAt(0)) - sceneryHash(seed, 71, b.charCodeAt(0)))
  const count = Math.min(blocks.length, Math.max(1, Math.round(blocks.length * 0.23)))
  return new Map(blocks.sort((a, b) => a.rank - b.rank).slice(0, count)
    .map(({ key }, index) => [key, kinds[index % kinds.length]]))
}

export interface YardFootprint {
  x: number
  z: number
  width: number
  depth: number
}

/** A teljes tárgy férjen el a telken, a házaktól és sétányoktól is elhúzva. */
export function fitsInYard(item: YardFootprint, width: number, depth: number, occupied: readonly YardFootprint[], gap = 0.08) {
  return item.x - item.width / 2 >= gap && item.x + item.width / 2 <= width - gap
    && item.z - item.depth / 2 >= gap && item.z + item.depth / 2 <= depth - gap
    && occupied.every((other) =>
      Math.abs(item.x - other.x) >= (item.width + other.width) / 2 + gap
      || Math.abs(item.z - other.z) >= (item.depth + other.depth) / 2 + gap)
}

/** Determinisztikus, enyhén szabálytalan ültetési pontok a teljes udvaron. */
export function yardSpots(width: number, depth: number, seed: number, spacing = 0.7) {
  const spots: Array<{ x: number; z: number; order: number }> = []
  for (let z = 0.55, row = 0; z <= depth - 0.55; z += spacing, row++) {
    for (let x = 0.55, column = 0; x <= width - 0.55; x += spacing, column++) {
      const hash = Math.imul((seed ^ Math.imul(row + 1, 73856093) ^ Math.imul(column + 1, 19349663)), 2654435761) >>> 0
      spots.push({ x: x + ((hash % 17) / 16 - 0.5) * 0.16,
        z: z + (((hash >>> 8) % 17) / 16 - 0.5) * 0.16, order: hash })
    }
  }
  return spots.sort((a, b) => a.order - b.order)
}
