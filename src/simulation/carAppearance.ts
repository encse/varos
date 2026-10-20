// A Kenney modellek felülről domináns színei, a colormap.png textúrából.
// A sorrend közös a 3D modellválasztással és a 2D autók színezésével.
export const CAR_APPEARANCES = [
  { model: 'sedan', color: '#e86147' },
  { model: 'hatchback-sports', color: '#5ac487' },
  { model: 'suv', color: '#82879d' },
  { model: 'taxi', color: '#ffc759' },
  { model: 'van', color: '#658ed6' },
] as const

export function carColor(colorIndex: number): string {
  return CAR_APPEARANCES[colorIndex % CAR_APPEARANCES.length]?.color ?? CAR_APPEARANCES[0].color
}
