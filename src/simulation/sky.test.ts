import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { DioramaSky } from './sky'

function setup() {
  const sky = new DioramaSky()
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 500)
  const target = new THREE.Vector3()
  const update = (time: number, distance: number, elevation = 25) => {
    const angle = THREE.MathUtils.degToRad(elevation)
    camera.position.set(0, Math.sin(angle) * distance * 30, Math.cos(angle) * distance * 30)
    sky.update(camera, target, 30, time)
    return sky.mesh.material.uniforms.skyAmount.value as number
  }
  return { sky, update }
}

describe('kétállapotú égbolt', () => {
  it('megállított kameránál is befejezi a teljes váltást, pontos végállapottal', () => {
    const { sky, update } = setup()
    expect(update(0, 1.3)).toBe(0)
    expect(update(100, 0.8)).toBe(0)
    expect(update(425, 0.8)).toBeCloseTo(0.5)
    expect(update(750, 0.8)).toBe(1)
    expect(update(2000, 0.8)).toBe(1)
    sky.dispose()
  })

  it('a határ körüli mozgás nem kapcsolgatja oda-vissza', () => {
    const { sky, update } = setup()
    expect(update(0, 0.9)).toBe(0)
    update(100, 0.8)
    expect(update(750, 0.9, 36)).toBe(1)
    expect(update(800, 0.86, 33)).toBe(1)
    expect(update(900, 1.0, 41)).toBe(1)
    update(1000, 1.1)
    expect(update(1650, 1.1)).toBe(0)
    expect(update(2000, 0.9, 36)).toBe(0)
    sky.dispose()
  })

  it('felülnézetben sötét marad, és visszafordított kameránál is végigfut az elkezdett animáció', () => {
    const { sky, update } = setup()
    expect(update(0, 0.5, 54)).toBe(0)
    update(100, 0.5, 20)
    expect(update(425, 1.4, 54)).toBeCloseTo(0.5)
    expect(update(750, 1.4, 54)).toBe(1)
    expect(update(751, 1.4, 54)).toBe(1)
    expect(update(1401, 1.4, 54)).toBe(0)
    sky.dispose()
  })
})
