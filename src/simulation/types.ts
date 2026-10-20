export type Direction = 0 | 1 | 2 | 3

export interface Coord {
  x: number
  y: number
}

export interface CrossingSpec {
  period: number
  green: Direction
}

export interface CityMap {
  columns: number
  rows: number
  horizontalLengths: number[]
  verticalLengths: number[]
  crossings: CrossingSpec[]
  width: number
  height: number
}

export interface CarSpec {
  speed: number
  x: number
  y: number
  direction: Direction
  color: number
  route: number[]
}

export type CarEvent = { type: 'delay' } | { type: 'car'; car: CarSpec }

export interface CarProgram {
  declaredCount: number
  events: CarEvent[]
}

export interface GeneratorSettings {
  columns: number
  rows: number
  streetLength: number
  cars: number
  seed: number
}
