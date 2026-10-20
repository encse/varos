import { describe, expect, it } from 'vitest'
import { autoFromSpec, CityEngine } from './engine'
import { generate } from './generator'
import { LookaheadMotion } from './lookahead'
import { carPoseAt, pathDistance } from './motion'

function straightCar(start: number, end: number) {
  const car = autoFromSpec({ speed: 3, x: 3, y: 0, direction: 1, color: 1, route: [] })
  car.visualPath = [{ x: 0, y: 0, direction: 1 }, { x: 3, y: 0, direction: 1 }]
  car.visualSpeed = { start, end }
  return car
}

describe('előretekintő animáció', () => {
  it('állásból gyorsít, megállás előtt fékez, utazás közben tartja a sebességet', () => {
    const accelerating = straightCar(0, 3)
    const braking = straightCar(3, 0)
    const cruising = straightCar(3, 3)
    const x = (car: typeof cruising, t: number) => carPoseAt(car, t)!.x
    expect(x(accelerating, 0.25) - x(accelerating, 0)).toBeLessThan(x(accelerating, 1) - x(accelerating, 0.75))
    expect(x(braking, 0.25) - x(braking, 0)).toBeGreaterThan(x(braking, 1) - x(braking, 0.75))
    for (const t of [0, 0.25, 0.5, 0.75, 1]) expect(x(cruising, t)).toBeCloseTo(3 * t)
    const epsilon = 0.000001
    expect((x(accelerating, epsilon) - x(accelerating, 0)) / epsilon).toBeCloseTo(0, 4)
    expect((x(braking, 1) - x(braking, 1 - epsilon)) / epsilon).toBeCloseTo(0, 4)
  })

  it('az előretekintés valódi forgalomban is egyező határsebességet ad, és nem változtatja meg a modellt', () => {
    let accelerated = false
    let braked = false
    let cruised = false
    for (const seed of [3, 17, 42]) {
      const { map, program } = generate({ columns: 2, rows: 2, streetLength: 8, cars: 50, seed })
      const engine = new CityEngine(map, program)
      const reference = new CityEngine(map, program)
      const preview = new CityEngine(map, program)
      const motion = new LookaheadMotion(engine)
      let previousSpeeds = engine.cars.map(() => 0)
      preview.step()
      for (let tick = 0; tick < 100; tick++) {
        motion.step()
        reference.step()
        preview.step()
        expect(engine.stats()).toEqual(reference.stats())
        expect(engine.intersections.map((node) => node.green)).toEqual(reference.intersections.map((node) => node.green))
        engine.cars.forEach((car, index) => {
          const expected = reference.cars[index]
          expect([car.x, car.y, car.direction, car.state, car.turning, car.canmove])
            .toEqual([expected.x, expected.y, expected.direction, expected.state, expected.turning, expected.canmove])
          const { start, end } = car.visualSpeed!
          const distance = pathDistance(car.visualPath)
          expect(start).toBeCloseTo(previousSpeeds[index], 10)
          if (pathDistance(preview.cars[index].visualPath) === 0) expect(end).toBe(0)
          accelerated ||= distance > 1 && start < end
          braked ||= distance > 1 && start > end
          cruised ||= distance > 1 && start === distance && end === distance

          // Egyenesre vetítve a sebességprofil nem fordulhat vissza és nem futhat túl.
          const straight = straightCar(start, end)
          straight.visualPath[1].x = distance
          let previousX = 0
          for (let sample = 0; sample <= 20; sample++) {
            const pose = carPoseAt(straight, sample / 20)!
            expect(pose.x).toBeGreaterThanOrEqual(previousX - 1e-10)
            expect(pose.x).toBeLessThanOrEqual(distance + 1e-10)
            previousX = pose.x
          }
        })
        previousSpeeds = engine.cars.map((car) => car.visualSpeed!.end)
      }
    }
    expect(accelerated).toBe(true)
    expect(braked).toBe(true)
    expect(cruised).toBe(true)
  })
})
