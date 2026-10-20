import type { Car, CarPose } from './engine'

export interface AnimatedCarPose extends CarPose {
  rotation: number
}

/** Egy logikai kör cellasorozatát folyamatos, lekerekített pályává alakítja. */
export function carPoseAt(car: Car, progress: number): AnimatedCarPose | null {
  // A jobb kanyar régi logikája ugyanarra a cellára előbb a régi, majd az új
  // iránnyal ír pontot. Ez állapotváltás, nem megtett útszakasz: ha időt adunk
  // neki, az autó a cella közepén helyben fordul. Ha előtte valóban haladt is,
  // a régi irányú duplikátumot kivesszük, az új irányt pedig az érkezési pontra
  // tesszük. A szimuláció és a foglaltság ettől változatlan marad.
  const path = withoutStationaryTurnSegments(car.visualPath)
  if (!path.length) {
    return car.state === 'active'
      ? { x: car.x, y: car.y, direction: car.direction, rotation: directionRotation(car.direction) }
      : null
  }
  if (progress >= 1 && car.state !== 'active') return null
  if (path.length === 1) {
    return { ...path[0], rotation: directionRotation(path[0].direction) }
  }

  const lastSegment = path.length - 1
  const cursor = Math.max(0, Math.min(1, progress)) * lastSegment
  const cornerRadius = 0.65
  const activeSegment = Math.min(Math.floor(cursor), lastSegment - 1)
  const activeFrom = path[Math.max(0, activeSegment)]
  const activeTo = path[Math.max(0, activeSegment) + 1]

  if (activeFrom.x === activeTo.x && activeFrom.y === activeTo.y && activeFrom.direction !== activeTo.direction) {
    const amount = cursor - activeSegment
    const eased = amount * amount * (3 - 2 * amount)
    return {
      x: activeFrom.x,
      y: activeFrom.y,
      direction: activeTo.direction,
      rotation: lerpAngle(directionRotation(activeFrom.direction), directionRotation(activeTo.direction), eased),
    }
  }

  // Ha a kör rögtön egy kanyarral kezdődik, nincs előző pályapont, amiből
  // a sarkot levághatnánk. A két cella közti egyenest egy szinuszos oldalívvel
  // hajlítjuk meg. Ez valamivel beljebb nyúlhat a kereszteződésbe (akár a szemközti
  // sáv széléig), viszont nem csinál horgot és végig előrefelé halad.
  if (activeSegment === 0 && activeFrom.direction !== activeTo.direction) {
    const amount = cursor
    const incoming = directionVector(activeFrom.direction)
    const outgoing = directionVector(activeTo.direction)
    const travelX = activeTo.x - activeFrom.x
    const travelY = activeTo.y - activeFrom.y
    const distance = Math.hypot(travelX, travelY) || 1
    const turnSide = Math.sign(incoming.x * outgoing.y - incoming.y * outgoing.x) || 1
    const bulge = Math.sin(amount * Math.PI) * Math.min(0.48, distance * 0.48) * turnSide
    const normalX = travelY / distance
    const normalY = -travelX / distance
    const x = activeFrom.x + travelX * amount + normalX * bulge
    const y = activeFrom.y + travelY * amount + normalY * bulge
    const eased = amount * amount * (3 - 2 * amount)
    return {
      x,
      y,
      direction: activeTo.direction,
      // A szög mindig monoton haladjon a régi iránytól az újig. Bizonyos
      // egykörös útvonalaknál a Bézier geometriai érintője rövid időre
      // visszafelé mutatna, miközben a pozíció íve továbbra is helyes.
      rotation: lerpAngle(directionRotation(activeFrom.direction), directionRotation(activeTo.direction), eased),
    }
  }

  // A cellasarok előtt letérünk az egyenesről, és egy másodfokú Bézier-ívvel
  // kötjük össze a két utcairányt. Így az autó nem megy át a derékszög csúcsán.
  for (let cornerIndex = 1; cornerIndex < path.length - 1; cornerIndex++) {
    const previous = path[cornerIndex - 1]
    const corner = path[cornerIndex]
    const next = path[cornerIndex + 1]
    const incoming = unit(corner.x - previous.x, corner.y - previous.y)
    const outgoing = unit(next.x - corner.x, next.y - corner.y)
    const cross = incoming.x * outgoing.y - incoming.y * outgoing.x
    if (Math.abs(cross) < 0.01) continue
    if (cursor < cornerIndex - cornerRadius || cursor > cornerIndex + cornerRadius) continue

    const amount = (cursor - (cornerIndex - cornerRadius)) / (cornerRadius * 2)
    const entry = { x: corner.x - incoming.x * cornerRadius, y: corner.y - incoming.y * cornerRadius }
    const exit = { x: corner.x + outgoing.x * cornerRadius, y: corner.y + outgoing.y * cornerRadius }
    const inverse = 1 - amount
    const x = inverse * inverse * entry.x + 2 * inverse * amount * corner.x + amount * amount * exit.x
    const y = inverse * inverse * entry.y + 2 * inverse * amount * corner.y + amount * amount * exit.y
    const dx = 2 * inverse * (corner.x - entry.x) + 2 * amount * (exit.x - corner.x)
    const dy = 2 * inverse * (corner.y - entry.y) + 2 * amount * (exit.y - corner.y)
    return {
      x,
      y,
      direction: amount < 0.5 ? corner.direction : next.direction,
      rotation: Math.atan2(dx, dy),
    }
  }

  const segment = Math.min(Math.floor(cursor), lastSegment - 1)
  const fromIndex = Math.max(0, segment)
  const toIndex = fromIndex + 1
  const from = path[fromIndex]
  const to = path[toIndex]
  const amount = cursor - segment
  const dx = to.x - from.x
  const dy = to.y - from.y
  return {
    x: from.x + dx * amount,
    y: from.y + dy * amount,
    direction: to.direction,
    rotation: Math.abs(dx) + Math.abs(dy) > 0.0001
      ? Math.atan2(dx, dy)
      : directionRotation(to.direction),
  }
}

export function directionRotation(direction: number) {
  return [Math.PI, Math.PI / 2, 0, -Math.PI / 2][direction] ?? 0
}

function unit(x: number, y: number) {
  const length = Math.hypot(x, y) || 1
  return { x: x / length, y: y / length }
}

function directionVector(direction: number) {
  return [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ][direction] ?? { x: 0, y: 1 }
}

function withoutStationaryTurnSegments(path: CarPose[]) {
  if (path.length < 3) return path
  return path.filter((point, index) => {
    if (index === 0 || index === path.length - 1) return true
    const previous = path[index - 1]
    const next = path[index + 1]
    const arrivedHere = previous.x !== point.x || previous.y !== point.y
    const turnsHere = point.x === next.x && point.y === next.y && point.direction !== next.direction
    return !(arrivedHere && turnsHere)
  })
}

function lerpAngle(from: number, to: number, amount: number) {
  const delta = ((to - from + Math.PI * 3) % (Math.PI * 2)) - Math.PI
  return from + delta * amount
}
