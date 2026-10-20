import { CityEngine, PALETTE, type Car } from './engine'
import { directionRotation, type AnimatedCarPose } from './motion'

const crisp = (value: number) => Math.round(value) + 0.5

export function renderCity(canvas: HTMLCanvasElement, engine: CityEngine) {
  const { map } = engine
  const maxWidth = 1120
  const maxHeight = 720
  const scale = Math.max(4, Math.floor(Math.min(maxWidth / (map.width + 2), maxHeight / (map.height + 2))))
  const padding = scale
  const width = (map.width + 2) * scale
  const height = (map.height + 2) * scale
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
  const context = canvas.getContext('2d')!
  context.imageSmoothingEnabled = false
  context.fillStyle = PALETTE[0]
  context.fillRect(0, 0, width, height)
  context.fillStyle = PALETTE[12]
  context.fillRect(padding, padding, map.width * scale, map.height * scale)

  let top = 0
  for (const blockHeight of map.verticalLengths) {
    let left = 0
    for (const blockWidth of map.horizontalLengths) {
      context.fillStyle = PALETTE[8]
      context.fillRect(padding + left * scale, padding + top * scale, blockWidth * scale, blockHeight * scale)
      left += blockWidth + 2
    }
    top += blockHeight + 2
  }

  context.strokeStyle = PALETTE[15]
  context.lineWidth = Math.max(1, Math.floor(scale / 8))
  context.setLineDash([Math.max(2, scale / 2), Math.max(2, scale / 2)])
  for (const y of engine.yCrossings) {
    context.beginPath()
    context.moveTo(padding, crisp(padding + y * scale))
    context.lineTo(padding + map.width * scale, crisp(padding + y * scale))
    context.stroke()
  }
  for (const x of engine.xCrossings) {
    context.beginPath()
    context.moveTo(crisp(padding + x * scale), padding)
    context.lineTo(crisp(padding + x * scale), padding + map.height * scale)
    context.stroke()
  }
  context.setLineDash([])

  for (const node of engine.intersections) {
    if (node.type !== 'normal') continue
    const x = padding + node.where.x * scale
    const y = padding + node.where.y * scale
    context.fillStyle = PALETTE[12]
    context.fillRect(x - scale, y - scale, scale * 2, scale * 2)
    const offset = scale + Math.max(2, scale / 6)
    const lights = [
      [x + offset, y + offset],
      [x - offset, y + offset],
      [x - offset, y - offset],
      [x + offset, y - offset],
    ]
    lights.forEach(([lx, ly], direction) => {
      context.beginPath()
      context.fillStyle = direction === node.green ? PALETTE[11] : PALETTE[9]
      context.arc(lx, ly, Math.max(2, scale / 8), 0, Math.PI * 2)
      context.fill()
    })
  }

  for (const car of engine.cars) {
    // Az eredeti program csak a ténylegesen valamelyik sorban vagy
    // kereszteződésben lévő autót rajzolta ki. A még be nem olvasott és a
    // kapunál várakozó példányok nem kerültek a képernyőre.
    if (car.state !== 'active') continue
    drawCar(context, car, {
      x: car.x,
      y: car.y,
      direction: car.direction,
      rotation: directionRotation(car.direction),
    }, scale, padding)
  }
}

function drawCar(context: CanvasRenderingContext2D, car: Car, pose: AnimatedCarPose, scale: number, padding: number) {
  const width = Math.max(2, scale * 0.5)
  const height = Math.max(2, scale * 0.75)
  const centerX = padding + (pose.x - 0.5) * scale
  const centerY = padding + (pose.y - 0.5) * scale
  const x = -width / 2
  const y = -height / 2
  context.save()
  context.translate(centerX, centerY)
  // A canvas Y tengelye lefelé nő, ezért a Three.js szögének előjele fordított.
  context.rotate(-pose.rotation)
  context.fillStyle = PALETTE[car.color] ?? PALETTE[2]
  context.fillRect(Math.round(x), Math.round(y), Math.ceil(width), Math.ceil(height))

  if (scale < 8) {
    context.restore()
    return
  }
  const light = Math.max(1, Math.floor(scale / 7))
  context.fillStyle = PALETTE[10]
  context.fillRect(x + 1, y, light, light)
  context.fillRect(x + width - light - 1, y, light, light)
  if (car.indicator) {
    context.fillStyle = PALETTE[13]
    const indicatorX = car.indicator === 1 ? x + width - light : x
    context.fillRect(indicatorX, y + height - light, light, light)
  }
  context.strokeStyle = PALETTE[12]
  context.lineWidth = 1
  context.strokeRect(x + width * 0.25, y + height * 0.25, width * 0.5, height * 0.5)
  context.restore()
}
