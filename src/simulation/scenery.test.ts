import { describe, expect, it } from 'vitest'
import { fitsInYard, planParks, yardSpots } from './scenery'
import { generate } from './generator'

describe('kertek elhelyezése', () => {
  it('a parkok helye városonként változik, újraindításkor megmarad, és több típust ad', () => {
    const layouts = new Set<string>()
    for (let seed = 0; seed < 32; seed++) {
      const { map } = generate({ columns: 3, rows: 3, streetLength: 6, cars: 1, seed })
      const parks = planParks(map)
      expect(parks).toEqual(planParks(map))
      expect(parks.size).toBe(4)
      expect(new Set(parks.values())).toEqual(new Set(['fountain', 'woodland', 'garden', 'picnic']))
      layouts.add([...parks.keys()].sort().join(','))
      for (const key of parks.keys()) {
        const [row, column] = key.split(':').map(Number)
        expect(row).toBeGreaterThanOrEqual(0)
        expect(row).toBeLessThanOrEqual(map.rows)
        expect(column).toBeGreaterThanOrEqual(0)
        expect(column).toBeLessThanOrEqual(map.columns)
      }
    }
    expect(layouts.size).toBeGreaterThan(25)
  })

  it('a túl kicsi telkekből nem csinál parkot', () => {
    const { map } = generate({ columns: 3, rows: 3, streetLength: 3, cars: 1, seed: 42 })
    expect(planParks(map).size).toBe(0)
  })

  it('a teljes tárgyat ellenőrzi a házak, sétányok és telekhatárok mellett', () => {
    const occupied = [
      { x: 3, z: 3, width: 2, depth: 2 },
      { x: 3, z: 0.3, width: 5, depth: 0.3 },
    ]
    expect(fitsInYard({ x: 1, z: 1, width: 0.5, depth: 0.5 }, 6, 6, occupied)).toBe(true)
    // A törzs középpontja elférne, a korona azonban már belógna a házba.
    expect(fitsInYard({ x: 1.7, z: 3, width: 1, depth: 1 }, 6, 6, occupied)).toBe(false)
    expect(fitsInYard({ x: 3, z: 0.65, width: 0.6, depth: 0.6 }, 6, 6, occupied)).toBe(false)
    expect(fitsInYard({ x: 5.8, z: 1, width: 0.6, depth: 0.6 }, 6, 6, occupied)).toBe(false)
  })

  it('a kert belsejét és széleit is bejárja, mindig ugyanazzal az elrendezéssel', () => {
    for (const [width, depth] of [[4, 4], [4, 8], [8, 4], [8, 8]]) {
      const spots = yardSpots(width, depth, 42)
      expect(spots).toEqual(yardSpots(width, depth, 42))
      expect(spots).not.toEqual(yardSpots(width, depth, 17))
      expect(spots.some(({ x, z }) => Math.abs(x - width / 2) < 0.7 && Math.abs(z - depth / 2) < 0.7)).toBe(true)
      for (const { x, z } of spots) {
        expect(x).toBeGreaterThan(0)
        expect(z).toBeGreaterThan(0)
        expect(x).toBeLessThan(width)
        expect(z).toBeLessThan(depth)
      }
    }
  })
})
