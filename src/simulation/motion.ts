import type { Car, CarPose, VisualTurn } from './engine'

export interface AnimatedCarPose extends CarPose {
  rotation: number
}

export const LANE_INSET = 0.18

export function carPoseAt(car: Car, progress: number, laneInset = 0): AnimatedCarPose | null {
  const path = car.visualPath
  if (progress >= 1 && car.state !== 'active') return null
  if (!path.length) return car.state === 'active' ? lanePose(car, laneInset) : null

  // Az irányváltás önmagában nem megtett út és nem kap animációs időt.
  const segments = path.slice(1).map((to, index) => ({
    from: path[index], to,
    length: Math.hypot(to.x - path[index].x, to.y - path[index].y),
  })).filter(({ length }) => length > 0)
  const distance = segments.reduce((sum, segment) => sum + segment.length, 0)
  let remaining = Math.max(0, Math.min(1, progress)) * distance
  let point = path.at(-1)!
  for (const segment of segments) {
    if (remaining <= segment.length) {
      const amount = remaining / segment.length
      point = {
        x: segment.from.x + (segment.to.x - segment.from.x) * amount,
        y: segment.from.y + (segment.to.y - segment.from.y) * amount,
        direction: amount < 1 ? segment.from.direction : segment.to.direction,
      }
      break
    }
    remaining -= segment.length
  }
  // A belépéskor rögzített ív a körhatárokon át is ugyanaz marad.
  for (const turn of car.visualTurns) {
    const pose = turnPose(point, turn, laneInset)
    if (pose) return pose
  }
  return lanePose(point, laneInset)
}

function turnPose(point: CarPose, turn: VisualTurn, inset: number): AnimatedCarPose | null {
  const incoming = directionVector(turn.incoming)
  const outgoingDirection = (turn.incoming + (turn.turn === 1 ? 3 : 1)) % 4
  const outgoing = directionVector(outgoingDirection)
  const entry = {
    x: turn.center.x + 0.5 - incoming.x * 1.5 - incoming.y * 0.5,
    y: turn.center.y + 0.5 - incoming.y * 1.5 + incoming.x * 0.5,
  }
  const dx = point.x - entry.x
  const dy = point.y - entry.y
  const alongIncoming = dx * incoming.x + dy * incoming.y
  const alongOutgoing = dx * outgoing.x + dy * outgoing.y
  const length = turn.turn === 1 ? 4 : 2
  if (alongIncoming < -1e-8 || alongOutgoing < -1e-8
    || alongIncoming > length / 2 + 1e-8 || alongOutgoing > length / 2 + 1e-8) return null
  const travelled = Math.max(0, Math.min(length, alongIncoming + alongOutgoing))
  // Balra előbb egyenesen belépünk, egyetlen cellanegyedben fordulunk,
  // majd egyenesen kihajtunk. A jobb kanyar eleve ebben a kis negyedben fut.
  const straight = turn.turn === 1 ? 1 : 0
  if (travelled < straight) {
    return lanePose({
      x: entry.x + incoming.x * travelled,
      y: entry.y + incoming.y * travelled,
      direction: turn.incoming,
    }, inset)
  }
  if (travelled > length - straight) {
    const outgoingDistance = travelled - length / 2
    return lanePose({
      x: entry.x + incoming.x * length / 2 + outgoing.x * outgoingDistance,
      y: entry.y + incoming.y * length / 2 + outgoing.y * outgoingDistance,
      direction: outgoingDirection as CarPose['direction'],
    }, inset)
  }
  const angle = (travelled - straight) / 2 * Math.PI / 2
  const radius = turn.turn === 1 ? 1 - inset : 1 + inset
  const sin = Math.sin(angle)
  const cos = Math.cos(angle)
  return {
    x: entry.x + incoming.x * straight + incoming.y * inset + outgoing.x * radius * (1 - cos) + incoming.x * radius * sin,
    y: entry.y + incoming.y * straight - incoming.x * inset + outgoing.y * radius * (1 - cos) + incoming.y * radius * sin,
    direction: angle < Math.PI / 4 ? turn.incoming : outgoingDirection as CarPose['direction'],
    rotation: Math.atan2(incoming.x * cos + outgoing.x * sin, incoming.y * cos + outgoing.y * sin),
  }
}

function lanePose(point: CarPose, inset: number): AnimatedCarPose {
  const direction = directionVector(point.direction)
  return {
    x: point.x + direction.y * inset,
    y: point.y - direction.x * inset,
    direction: point.direction,
    rotation: directionRotation(point.direction),
  }
}

export function directionRotation(direction: number) {
  return [Math.PI, Math.PI / 2, 0, -Math.PI / 2][direction] ?? 0
}

function directionVector(direction: number) {
  return [
    { x: 0, y: -1 }, { x: 1, y: 0 },
    { x: 0, y: 1 }, { x: -1, y: 0 },
  ][direction] ?? { x: 0, y: 1 }
}
