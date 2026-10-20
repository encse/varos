import type { CarEvent, CarProgram, CityMap, Direction, GeneratorSettings } from './types'

function rng(seed: number) {
  let state = seed >>> 0 || 0x6d2b79f5
  return () => {
    state += 0x6d2b79f5
    let n = state
    n = Math.imul(n ^ (n >>> 15), n | 1)
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61)
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296
  }
}

const int = (random: () => number, max: number) => Math.floor(random() * max)

export function generateRandomCity(seed: number) {
  const random = rng(seed)
  const columns = 2 + int(random, 4)
  const rows = 2 + int(random, 4)
  const streetLength = 4 + int(random, 5)
  const cars = Math.max(80, Math.min(400, columns * rows * (8 + int(random, 9))))
  return generate({ columns, rows, streetLength, cars, seed })
}

export function generate(settings: GeneratorSettings): { map: CityMap; program: CarProgram } {
  const random = rng(settings.seed)
  const horizontalLengths = Array(settings.columns + 1).fill(settings.streetLength)
  const verticalLengths = Array(settings.rows + 1).fill(settings.streetLength)
  const crossings = Array.from({ length: settings.columns * settings.rows }, () => ({
    period: int(random, 4) + 1,
    green: int(random, 4) as Direction,
  }))
  const map: CityMap = {
    scenerySeed: settings.seed,
    columns: settings.columns,
    rows: settings.rows,
    horizontalLengths,
    verticalLengths,
    crossings,
    width: horizontalLengths.reduce((a, b) => a + b, 0) + settings.columns * 2,
    height: verticalLengths.reduce((a, b) => a + b, 0) + settings.rows * 2,
  }
  const xCrossings = crossingPositions(horizontalLengths)
  const yCrossings = crossingPositions(verticalLengths)
  const events: CarEvent[] = []
  for (let n = 0; n < settings.cars; n++) {
    if (int(random, 10) === 0) events.push({ type: 'delay' })
    const direction = int(random, 4) as Direction
    let x = 0
    let y = 0
    if (direction === 0) {
      x = xCrossings[int(random, xCrossings.length)] + 1
      y = map.height + 1
    } else if (direction === 1) {
      x = 0
      y = yCrossings[int(random, yCrossings.length)] + 1
    } else if (direction === 2) {
      x = xCrossings[int(random, xCrossings.length)]
      y = 0
    } else {
      x = map.width + 1
      y = yCrossings[int(random, yCrossings.length)]
    }
    const route = [2, 2]
    if (int(random, 2)) route.push(2)
    const varied = int(random, 20)
    for (let i = 0; i < varied; i++) route.push((int(random, 3) + 1) as 1 | 2 | 3)
    route.push(...Array(20).fill(2))
    events.push({
      type: 'car',
      car: { speed: int(random, 4) + 1, x, y, direction, color: int(random, 7) + 1, route },
    })
  }
  const program = { declaredCount: settings.cars, events }
  return { map, program }
}

export function crossingPositions(lengths: number[]) {
  const positions: number[] = []
  let value = -1
  for (let i = 0; i < lengths.length - 1; i++) {
    value += lengths[i] + 2
    positions.push(value)
  }
  return positions
}
