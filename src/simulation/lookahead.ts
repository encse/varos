import { CityEngine } from './engine'
import { pathDistance } from './motion'

// A harmonikus közép állásnál nullát ad, azonos távoknál tartja a sebességet.
// Mindkét szomszédos táv kétszeresénél kisebb, így a Hermite-görbe monoton.
function boundarySpeed(before: number, after: number): number {
  return before + after === 0 ? 0 : 2 * before * after / (before + after)
}

/** A forgalmi modellt változatlanul hagyó, egy körrel előrébb futó animációs segéd. */
export class LookaheadMotion {
  private readonly forecast: CityEngine

  constructor(private readonly engine: CityEngine) {
    this.forecast = new CityEngine(engine.map, engine.program)
  }

  step() {
    // Az első lépéskor készül az első előrejelzés; kezdetben minden autó áll.
    if (this.forecast.tickCount === 0) this.forecast.step()
    const previous = this.engine.cars.map((car) => pathDistance(car.visualPath))
    this.engine.step()
    this.forecast.step()
    this.engine.cars.forEach((car, index) => {
      const distance = pathDistance(car.visualPath)
      const next = pathDistance(this.forecast.cars[index].visualPath)
      car.visualSpeed = {
        start: boundarySpeed(previous[index], distance),
        end: boundarySpeed(distance, next),
      }
    })
  }
}
