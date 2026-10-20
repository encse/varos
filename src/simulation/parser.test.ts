import { describe, expect, it } from 'vitest'
import { generate, generateRandomCity } from './generator'
import { Auto, CityEngine, Kereszt, KERESZT_NORM, LAMP_GREEN, Sor, autoFromSpec } from './engine'
import { carPoseAt, LANE_INSET } from './motion'
import type { CarProgram, Direction } from './types'

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
  it('balra csak egy kis negyedívben fordul, előtte és utána egyenesen halad', () => {
    const car = autoFromSpec({ speed: 1, x: 6, y: 5, direction: 1, color: 1, route: [1] })
    car.visualTurns = [{ center: { x: 4, y: 4 }, incoming: 2, turn: 1 }]
    car.visualPath = [
      { x: 4, y: 3, direction: 2 },
      { x: 4, y: 4, direction: 2 },
      { x: 4, y: 5, direction: 2 },
      { x: 5, y: 5, direction: 1 },
      { x: 6, y: 5, direction: 1 },
    ]
    const before = carPoseAt(car, 0.125, LANE_INSET)!
    expect(before.x).toBeCloseTo(4 + LANE_INSET)
    expect(before.y).toBeCloseTo(3.5)
    expect(before.rotation).toBeCloseTo(0)
    const middle = carPoseAt(car, 0.5, LANE_INSET)!
    const radius = 1 - LANE_INSET
    expect(middle.x).toBeCloseTo(5 - radius * Math.SQRT1_2)
    expect(middle.y).toBeCloseTo(4 + radius * Math.SQRT1_2)
    expect(middle.rotation).toBeCloseTo(Math.PI / 4)
    const after = carPoseAt(car, 0.875, LANE_INSET)!
    expect(after.x).toBeCloseTo(5.5)
    expect(after.y).toBeCloseTo(5 - LANE_INSET)
    expect(after.rotation).toBeCloseTo(Math.PI / 2)
  })

  it('többautós forgalomban és megálláskor is folytonos marad a kanyar', () => {
    for (const seed of [3, 17, 42]) {
      const { map, program } = generate({ columns: 2, rows: 2, streetLength: 4, cars: 80, seed })
      const city = new CityEngine(map, program)
      const previous = new Map<Auto, NonNullable<ReturnType<typeof carPoseAt>>>()
      for (let tick = 0; tick < 150; tick++) {
        city.go()
        for (const car of city.cars) {
          const start = carPoseAt(car, 0, LANE_INSET)
          const before = previous.get(car)
          if (before && start) {
            expect(start.x).toBeCloseTo(before.x, 8)
            expect(start.y).toBeCloseTo(before.y, 8)
            expect(Math.sin(start.rotation)).toBeCloseTo(Math.sin(before.rotation), 8)
            expect(Math.cos(start.rotation)).toBeCloseTo(Math.cos(before.rotation), 8)
          }
          const end = carPoseAt(car, 1, LANE_INSET)
          if (end) previous.set(car, end)
          else previous.delete(car)
        }
      }
    }
  })

  it('minden irányból, mindkét kanyarban folytonos, a mozgás felé néző pályát ad', () => {
    for (const direction of [0, 1, 2, 3] as Direction[]) {
      for (const turn of [1, 3]) {
        for (const speed of [1, 3]) {
          const [x, y] = [[5, 9], [0, 5], [4, 0], [9, 4]][direction]
          const city = singleCrossingEngine(100, {
            declaredCount: 1,
            events: [{ type: 'car', car: { x, y, direction, speed, color: 1, route: [turn, 2] } }],
          })
          city.intersections.find((node) => node.type === 'normal')!.melyikZold = direction
          const crossing = city.intersections.find((node) => node.type === 'normal')!
          crossing.utak.forEach((road, index) => road!.lamp(index === direction ? LAMP_GREEN : 1))
          let previous: ReturnType<typeof carPoseAt> = null
          let curved = false
          for (let tick = 0; tick < 18; tick++) {
            city.go()
            const car = city.cars[0]
            const start = carPoseAt(car, 0, LANE_INSET)
            if (previous && start) {
              expect(start.x).toBeCloseTo(previous.x, 8)
              expect(start.y).toBeCloseTo(previous.y, 8)
              expect(Math.cos(start.rotation)).toBeCloseTo(Math.cos(previous.rotation), 8)
              expect(Math.sin(start.rotation)).toBeCloseTo(Math.sin(previous.rotation), 8)
            }
            for (let sample = 1; sample < 100; sample++) {
              const p = sample / 100
              const pose = carPoseAt(car, p, LANE_INSET)
              const next = carPoseAt(car, p + 0.00001, LANE_INSET)
              if (!pose || !next) continue
              const dx = next.x - pose.x
              const dy = next.y - pose.y
              const length = Math.hypot(dx, dy)
              if (length < 1e-9) continue
              expect(dx / length).toBeCloseTo(Math.sin(pose.rotation), 3)
              expect(dy / length).toBeCloseTo(Math.cos(pose.rotation), 3)
              if (Math.abs(dx) > 1e-8 && Math.abs(dy) > 1e-8) curved = true
            }
            previous = carPoseAt(car, 1, LANE_INSET)
          }
          expect(curved, `irány=${direction}, kanyar=${turn}, sebesség=${speed}, hely=${city.cars[0].x},${city.cars[0].y}, állapot=${city.cars[0].state}`).toBe(true)
        }
      }
    }
  })

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
    rightTurn.visualTurns = [{ center: { x: 4, y: 4 }, incoming: 2, turn: 3 }]
    const turning = carPoseAt(rightTurn, 0.75)!
    expect(turning.x).toBeLessThan(4)
    expect(turning.y).toBeGreaterThan(3)
    expect(turning.y).toBeLessThan(4)
    expect(turning.rotation).toBeCloseTo(-Math.PI * 0.75 / 4)
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
    const car = autoFromSpec({ speed: 2, x: 3, y: 4, direction: 3, color: 1, route: [3] })
    car.visualTurns = [{ center: { x: 4, y: 4 }, incoming: 2, turn: 3 }]
    car.visualPath = [
      { x: 4, y: 3, direction: 2 },
      { x: 4, y: 4, direction: 3 },
      { x: 3, y: 4, direction: 3 },
    ]
    const corner = carPoseAt(car, 0.5)!
    expect(corner.x).toBeCloseTo(3 + Math.SQRT1_2)
    expect(corner.y).toBeCloseTo(3 + Math.SQRT1_2)
    expect(corner.rotation).toBeCloseTo(-Math.PI / 4)
  })

  it('a kör elején induló kanyar sem ugrik rögtön az új irányba', () => {
    const car = autoFromSpec({ speed: 1, x: 3, y: 4, direction: 3, color: 1, route: [3] })
    car.visualTurns = [{ center: { x: 4, y: 4 }, incoming: 2, turn: 3 }]
    car.visualPath = [
      { x: 4, y: 4, direction: 3 },
      { x: 3, y: 4, direction: 3 },
    ]
    const halfway = carPoseAt(car, 0.5)!
    expect(halfway.x).toBeGreaterThan(3)
    expect(halfway.x).toBeLessThan(4)
    expect(halfway.y).toBeGreaterThan(3)
    expect(halfway.y).toBeLessThan(4)
    expect(halfway.rotation).toBeCloseTo(-3 * Math.PI / 8)
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
