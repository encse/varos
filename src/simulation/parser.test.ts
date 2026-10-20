import { describe, expect, it } from 'vitest'
import { generate, generateRandomCity } from './generator'
import { Auto, CityEngine, Kereszt, KERESZT_NORM, LAMP_GREEN, Sor, autoFromSpec } from './engine'
import { carPoseAt } from './motion'
import type { CarProgram } from './types'

function singleCrossingEngine(period: number, program: CarProgram) {
  return new CityEngine({
    columns: 1,
    rows: 1,
    horizontalLengths: [3, 3],
    verticalLengths: [3, 3],
    crossings: [{ period, green: 2 }],
    width: 8,
    height: 8,
  }, program)
}

describe('generátor és motor', () => {
  it('a gyorsgenerálás változatos, korlátozott méretű és futtatható városokat ad', () => {
    const layouts = new Set<string>()
    for (let seed = 0; seed < 32; seed++) {
      const result = generateRandomCity(seed)
      const { map, program } = result
      expect(map.columns).toBeGreaterThanOrEqual(2)
      expect(map.columns).toBeLessThanOrEqual(5)
      expect(map.rows).toBeGreaterThanOrEqual(2)
      expect(map.rows).toBeLessThanOrEqual(5)
      for (const length of [...map.horizontalLengths, ...map.verticalLengths]) {
        expect(length).toBeGreaterThanOrEqual(4)
        expect(length).toBeLessThanOrEqual(8)
      }
      expect(program.declaredCount).toBeGreaterThanOrEqual(80)
      expect(program.declaredCount).toBeLessThanOrEqual(400)
      layouts.add(`${map.columns},${map.rows},${map.horizontalLengths[0]}`)
      const engine = new CityEngine(map, program)
      for (let tick = 0; tick < 30; tick++) engine.step()
      expect(engine.stats().tick).toBe(30)
    }
    expect(layouts.size).toBeGreaterThan(1)
  })

  it('azonos seedből azonos, futtatható várost készít', () => {
    const settings = { columns: 3, rows: 2, streetLength: 5, cars: 30, seed: 42 }
    const first = generate(settings)
    const second = generate(settings)
    expect(first.map).toEqual(second.map)
    expect(first.program).toEqual(second.program)
    const engine = new CityEngine(first.map, first.program)
    expect(() => {
      for (let i = 0; i < 10; i++) engine.step()
    }).not.toThrow()
    expect(engine.stats().tick).toBe(10)
  })

})

describe('soronként portolt osztályok', () => {
  it('a bal és jobb kanyar eltérő motorfázisát is rögzíti a megjelenítéshez', () => {
    const paths = new Map<number, Auto['visualPath']>()
    for (const turn of [1, 3]) {
      const city = singleCrossingEngine(20, {
        declaredCount: 1,
        events: [{ type: 'car', car: { speed: 1, x: 4, y: 0, direction: 2, color: 1, route: [turn] } }],
      })
      for (let tick = 0; tick < 12; tick++) {
        city.go()
        const car = city.carptr[0]
        if (new Set(car.visualPath.map((pose) => pose.direction)).size > 1) {
          paths.set(turn, car.visualPath.map((pose) => ({ ...pose })))
        }
      }
    }
    expect(paths.get(1)).toEqual([
      { x: 4, y: 5, direction: 2 },
      { x: 5, y: 5, direction: 1 },
    ])
    expect(paths.get(3)).toEqual([
      { x: 4, y: 3, direction: 2 },
      { x: 4, y: 4, direction: 2 },
      { x: 4, y: 4, direction: 3 },
    ])
    const rightTurn = autoFromSpec({ speed: 1, x: 4, y: 4, direction: 3, color: 1, route: [3] })
    rightTurn.visualPath = paths.get(3)!
    const turning = carPoseAt(rightTurn, 0.75)!
    expect(turning.x).toBeGreaterThan(4)
    expect(turning.y).toBeGreaterThan(3)
    expect(turning.y).toBeLessThan(4)
    expect(turning.rotation).toBeLessThan(-Math.PI / 2 * 0.75)
  })

  it('az Auto.turn(int) az aktuális irányt adja vissza és nem fogyaszt útvonalat', () => {
    const car = autoFromSpec({ speed: 2, x: 7, y: 7, direction: 2, color: 1, route: [1, 2, 3] })
    expect(car.turn(2)).toBe(2)
    expect(car.turning).toBe(0)
    expect(car.turn()).toBe(1)
    expect(car.direction).toBe(1)
    expect(car.turning).toBe(1)
  })

  it('a Sor az eredeti mozgatási ciklussal lépteti a sebességnyi cellát', () => {
    const car = autoFromSpec({ speed: 3, x: 0, y: 8, direction: 1, color: 1, route: [2] })
    const sor = new Sor(6, 1)
    expect(sor.in(car)).toBe(1)
    sor.lamp(LAMP_GREEN)
    expect(sor.mozgat(0)).toBeNull()
    expect(car.x).toBe(3)
  })

  it('a megjelenítés a gyors autó útját is egycellás szakaszokra bontja', () => {
    const car = autoFromSpec({ speed: 3, x: 0, y: 8, direction: 1, color: 1, route: [2] })
    car.beginVisualStep()
    car.go(3)
    expect(car.visualPath.map(({ x, y }) => [x, y])).toEqual([[0, 8], [1, 8], [2, 8], [3, 8]])
    expect(carPoseAt(car, 0.5)).toMatchObject({ x: 1.5, y: 8, direction: 1 })
  })

  it('a kanyarban görbített pályát és köztes fordulási szöget ad', () => {
    const car = autoFromSpec({ speed: 2, x: 1, y: 3, direction: 2, color: 1, route: [2] })
    car.visualPath = [
      { x: 0, y: 1, direction: 1 },
      { x: 1, y: 1, direction: 1 },
      { x: 1, y: 2, direction: 2 },
      { x: 1, y: 3, direction: 2 },
    ]
    const corner = carPoseAt(car, 1 / 3)!
    expect(corner.x).toBeCloseTo(0.8375)
    expect(corner.y).toBeCloseTo(1.1625)
    expect(corner.rotation).toBeCloseTo(Math.PI / 4)
  })

  it('a kör elején induló kanyar sem ugrik rögtön az új irányba', () => {
    const car = autoFromSpec({ speed: 1, x: 1, y: 2, direction: 2, color: 1, route: [2] })
    car.visualPath = [
      { x: 1, y: 1, direction: 1 },
      { x: 1, y: 2, direction: 2 },
    ]
    const halfway = carPoseAt(car, 0.5)!
    expect(halfway.x).toBeGreaterThan(1)
    expect(halfway.y).toBeGreaterThan(1)
    expect(halfway.y).toBeLessThan(2)
    expect(halfway.rotation).toBeCloseTo(Math.PI / 4)
  })

  it('a Kereszt.ujkor a kereszteződésen belül pontosan egy lépést enged', () => {
    const car = new Auto()
    car.speed = 4
    car.canmove = 0
    const kereszt = new Kereszt()
    kereszt.tipus = KERESZT_NORM
    kereszt.terulet[2] = car
    kereszt.ujkor()
    expect(car.canmove).toBe(1)
  })

  it('egy egyenes autó az eredeti cellasorrendben halad át a városon', () => {
    const city = singleCrossingEngine(9, {
      declaredCount: 1,
      events: [{ type: 'car', car: { speed: 1, x: 4, y: 0, direction: 2, color: 1, route: [2, 2] } }],
    })
    const positions: Array<[number, number, string]> = []
    for (let i = 0; i < 9; i++) {
      city.go()
      const car = city.carptr[0]
      positions.push([car.where.x, car.where.y, car.state])
    }
    expect(positions).toEqual([
      [4, 1, 'active'], [4, 2, 'active'], [4, 3, 'active'],
      [4, 4, 'active'], [4, 5, 'active'], [4, 6, 'active'],
      [4, 7, 'active'], [4, 8, 'active'], [4, 9, 'finished'],
    ])
  })
})
