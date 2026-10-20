import type { CarProgram, CarSpec, CityMap, Coord, Direction } from './types'

export const AUTO_VAR = 1
export const AUTO_MEGY = 0
export const AUTO_MEGHAL = -1
const AUTO_OLVASATLAN = -2

export const LAMP_GREEN = 0
export const LAMP_RED = 1
export const KERESZT_NORM = 1
export const KERESZT_SPEC = 2

export const PALETTE = [
  '#000000', '#410393', '#DDDCDF', '#30A084', '#04459A', '#64A1BA',
  '#8FA88E', '#400040', '#AAAAAA', '#FE0202', '#821111', '#44CF21',
  '#404040', '#FCD703', '#CAD8FA', '#FFFFFF',
]

export interface CarPose {
  x: number
  y: number
  direction: Direction
}

export interface VisualTurn {
  center: Coord
  incoming: Direction
  turn: 1 | 3
}

/** Az ifstream viselkedésének böngészős megfelelője. */
class AutoFile {
  private at = 0

  constructor(private readonly program: CarProgram) {}

  next() {
    return this.program.events[this.at++]
  }
}

/** CAR.H / CAR.CPP közvetlen TypeScript-portja. */
export class Auto {
  speed = 0
  canmove = 0
  allapot = AUTO_OLVASATLAN
  color = 0
  turning = 0
  index = 0
  hatter = 0
  where: Coord = { x: 0, y: 0 }
  direction: Direction = 0
  /** Csak a megjelenítés használja; a szimuláció döntéseibe nem szól bele. */
  visualPath: CarPose[] = []
  visualTurns: VisualTurn[] = []
  route: number[] = [0]
  hossz = 0
  EGYSEG = 0
  ELTOL_X = 0
  ELTOL_Y = 0

  constructor() {
    // Az eredeti konstruktor: turning=0; index=0; hatter=0;
    this.turning = 0
    this.index = 0
    this.hatter = 0
  }

  go(i: number) {
    if (i > this.speed) i = this.speed
    if (this.canmove) {
      this.canmove--
      this.clear()
      this.hatter = 12
      const start = { x: this.where.x, y: this.where.y, direction: this.direction }
      const pendingTurn = this.visualPath.at(-1)
      const beforeTurn = this.visualPath.at(-2)
      // Ha az irányváltást még ugyanebben a körben mozgás követi, a fordulást
      // a következő cellán át animáljuk, nem külön helyben álló szakaszként.
      if (pendingTurn && beforeTurn
        && pendingTurn.x === start.x && pendingTurn.y === start.y
        && beforeTurn.x === start.x && beforeTurn.y === start.y
        && pendingTurn.direction === start.direction && beforeTurn.direction !== start.direction) {
        this.visualPath.pop()
      }
      const previous = this.visualPath.at(-1)
      if (!previous) this.visualPath.push(start)
      switch (this.direction) {
        case 0: this.where.y -= i; break
        case 1: this.where.x += i; break
        case 2: this.where.y += i; break
        case 3: this.where.x -= i
      }
      for (let step = 1; step <= i; step++) {
        this.visualPath.push({
          x: start.x + (this.direction === 1 ? step : this.direction === 3 ? -step : 0),
          y: start.y + (this.direction === 2 ? step : this.direction === 0 ? -step : 0),
          direction: this.direction,
        })
      }
      this.write()
      return i
    }
    return 0
  }

  can_go() { return this.canmove }

  you_can_go() {
    this.canmove = this.speed
    return this.speed
  }

  nextturning() { return this.route[this.turning] ?? 0 }

  turn(): number
  turn(a: number): Direction
  turn(a?: number): number | Direction {
    this.clear()
    const previousDirection = this.direction
    if (a === undefined) {
      const route = this.route[this.turning++] ?? 0
      switch (route) {
        case 0: return 0
        case 1: this.direction = ((this.direction + 3) % 4) as Direction; break
        case 3: this.direction = ((this.direction + 1) % 4) as Direction
      }
      this.recordVisualTurn(previousDirection)
      this.write()
      return 1
    }

    switch (a) {
      case 1: this.direction = ((this.direction + 3) % 4) as Direction; break
      case 3: this.direction = ((this.direction + 1) % 4) as Direction
    }
    this.recordVisualTurn(previousDirection)
    this.write()
    // Lényeges: az eredeti turn(int) az irányt adja vissza, nem sikerességet.
    return this.direction
  }

  irany() { return this.direction }

  beginVisualStep() {
    this.visualTurns = this.visualTurns.filter(({ center }) =>
      Math.abs(this.x - center.x) <= 3 && Math.abs(this.y - center.y) <= 3)
    this.visualPath = this.state === 'active'
      ? [{ x: this.where.x, y: this.where.y, direction: this.direction }]
      : []
  }

  private recordVisualTurn(previousDirection: Direction) {
    if (previousDirection === this.direction) return
    const last = this.visualPath.at(-1)
    if (!last || last.x !== this.where.x || last.y !== this.where.y) {
      this.visualPath.push({ x: this.where.x, y: this.where.y, direction: previousDirection })
    }
    this.visualPath.push({ x: this.where.x, y: this.where.y, direction: this.direction })
  }

  position(): Coord { return { ...this.where } }

  read(data: AutoFile) {
    const event = data.next()
    // A különálló 0 ugyanúgy megszakítja az adott kör beolvasási ciklusát.
    if (!event || event.type === 'delay') return 0
    const spec = event.car
    this.speed = spec.speed
    this.where.x = spec.x
    this.where.y = spec.y
    this.direction = spec.direction
    this.color = spec.color
    this.route = [...spec.route, 0]
    this.hossz = spec.route.length
    this.canmove = this.speed
    this.allapot = AUTO_MEGY
    return 1
  }

  // A modell és a rajzolás szét van választva; ezeket a canvas-renderer helyettesíti.
  write() {}
  clear() {}

  init(a: number, b: number, c: number) {
    this.EGYSEG = a
    this.ELTOL_X = b
    this.ELTOL_Y = c
  }

  get state(): 'unread' | 'waiting' | 'active' | 'finished' {
    if (this.allapot === AUTO_OLVASATLAN) return 'unread'
    if (this.allapot === AUTO_VAR) return 'waiting'
    if (this.allapot === AUTO_MEGHAL) return 'finished'
    return 'active'
  }

  // A renderer visszafelé kompatibilis nevei.
  get x() { return this.where.x }
  get y() { return this.where.y }
  get indicator() { return this.index }
}

/** SOR.H / SOR.CPP közvetlen TypeScript-portja. */
export class Sor {
  buf: Array<Auto | null>
  lamp_color = LAMP_GREEN
  hossz: number
  dirty = 0
  last = -1
  irany: number
  kimehet = 1
  holtpont = 1

  constructor(h: number, a: number) {
    this.hossz = h
    this.irany = a
    this.buf = Array<Auto | null>(h).fill(null)
    this.lamp_color = LAMP_GREEN
    this.last = -1
    this.kimehet = 1
    this.holtpont = 1
  }

  in(car: Auto) {
    if (!this.buf[this.hossz - 1]) {
      this.last = this.hossz - 1
      this.buf[this.last] = car
      car.index = car.nextturning()
      if (car.index === 2) car.index = 0
      car.go(1)
      return 1
    }
    return 0
  }

  lamp(a: number) {
    if (a === LAMP_GREEN || a === LAMP_RED) this.lamp_color = a
  }

  kesz() { return 1 - this.holtpont }

  ujkor() {
    for (let i = 0; i < this.hossz; i++) {
      if (this.buf[i]) this.buf[i]!.you_can_go()
    }
    this.holtpont = 1
  }

  next(s: number) {
    for (let k = s; k < this.hossz; k++) {
      if (this.buf[k]) return k
    }
    return -1
  }

  mozgat(k: number) {
    let i: number
    let hol: number
    this.kimehet = k
    let belepoAuto: Auto | null = null
    this.dirty = 0
    do {
      i = 0
      hol = 0
      this.holtpont = 0
      while (hol >= 0) {
        hol = this.next(i)
        if (hol >= 0) {
          // Ha az autó még mehet előre
          if (this.buf[hol]!.can_go()) {
            // és bemegyünk a kereszteződésbe
            if (!hol) {
              if (this.kimehet && !this.lamp_color) {
                i = 0
                this.buf[hol]!.go(1)
                belepoAuto = this.buf[hol]
                this.buf[hol] = null
                this.holtpont = this.dirty = 1
                this.kimehet = 0
              } else {
                // Nem tudunk előbbre menni, mert nem mehetünk be.
                i++
              }
            } else {
              // vagy előbbre megyünk a sorban
              if (hol > i) {
                i = hol
                this.buf[i - 1] = this.buf[hol]
                this.buf[hol]!.go(1)
                this.buf[hol] = null
                this.holtpont = this.dirty = 1
              } else i++
            }
          } else i++
        }
      }
    } while (this.holtpont)
    for (i = 0; i < this.hossz; i++) if (this.buf[i]) this.last = i
    return belepoAuto
  }
}

interface Keresztezodes {
  where: Coord
  uthosszok: number[]
  szomszedok: Array<Kereszt | null>
  periodusido: number
  melyikZold: number
  tipus: number
}

/** KERESZT.H / KERESZT.CPP közvetlen TypeScript-portja. */
export class Kereszt {
  utak: Array<Sor | null> = [null, null, null, null]
  where: Coord = { x: 0, y: 0 }
  szomszedok: Array<Kereszt | null> = [null, null, null, null]
  tipus = KERESZT_SPEC
  terulet: Array<Auto | null> = [null, null, null, null]
  kilep = [0, 0, 0, 0]
  periodusido = -1
  melyikZold = -1
  ido = 0
  clock_seged = 0
  EGYSEG = 0
  ELTOL_X = 0
  ELTOL_Y = 0

  Beallit(k: Keresztezodes) {
    for (let i = 0; i < 4; i++) {
      if (k.uthosszok[i]) {
        this.utak[i] = new Sor(k.uthosszok[i], 1)
        this.utak[i]!.lamp(LAMP_RED)
      } else this.utak[i] = null
      this.terulet[i] = null
      this.szomszedok[i] = k.szomszedok[i]
    }
    this.where.y = k.where.y
    this.where.x = k.where.x
    this.periodusido = k.periodusido
    this.melyikZold = k.melyikZold
    // Az eredeti jobb alsó őr-kereszteződése -1 indexet használna (UB).
    // A működő logikát megtartva csak a létező útnál állítunk zöldet.
    if (this.melyikZold >= 0) this.utak[this.melyikZold]!.lamp(LAMP_GREEN)
    this.tipus = k.tipus
    this.ido = 0
  }

  position(): Coord { return { ...this.where } }

  ujkor() {
    for (let i = 0; i < 4; i++) {
      if (this.utak[i]) this.utak[i]!.ujkor()
      // Pontosan az eredeti: kereszteződésen belül csak egyet léphet.
      if (this.terulet[i]) this.terulet[i]!.canmove = 1
    }
    this.clock_seged = 0
  }

  clock() {
    let dirty2 = 0
    if (this.tipus === KERESZT_SPEC) dirty2 = this.suburb()
    else {
      let i: number
      let dirty: number
      // Először a kereszteződés területén belül mozgunk.
      do {
        dirty = 0
        for (i = 0; i < 4; i++) {
          const car = this.terulet[i]
          if (car && car.canmove) {
            // Ha helyben vagyunk, akkor megpróbálunk kilépni.
            if (i === this.kilep[i]) {
              const irany = car.irany()
              const destination = this.szomszedok[i]?.utak[irany]
              if (!destination) throw new Error(`Érvénytelen útkapcsolat: kereszteződés (${this.where.x},${this.where.y}), kijárat ${i}, irány ${irany}.`)
              if (destination.in(car)) {
                this.terulet[i] = null
                dirty = 1
                dirty2 = 1
              }
            // Különben megyünk szépen tovább.
            } else if (!this.terulet[(i + 3) % 4]) {
              const irany = car.turn(2)
              if ((i + 1) % 4 === irany) car.turn(1)
              car.go(1)
              this.terulet[(i + 3) % 4] = car
              this.terulet[i] = null
              this.kilep[(i + 3) % 4] = this.kilep[i]
              dirty = 1
              dirty2 = 1
            }
          }
        }
      } while (dirty)

      // Ha váltani kell a lámpát.
      if (this.ido === this.periodusido) {
        this.ido = 0
        this.utak[this.melyikZold]!.lamp(LAMP_RED)
        this.melyikZold = (this.melyikZold + 1) % 4
        this.utak[this.melyikZold]!.lamp(LAMP_GREEN)
      }
      this.kirajzol()

      // A piros lámpás sorokat mozgatjuk.
      for (i = 0; i < 4; i++) {
        if (i !== this.melyikZold) {
          this.utak[i]!.mozgat(0)
          if (this.utak[i]!.dirty) dirty2 = 1
        }
      }

      if (this.terulet[this.melyikZold]) {
        this.utak[this.melyikZold]!.mozgat(0)
        if (this.utak[this.melyikZold]!.dirty) dirty2 = 1
      } else {
        // A zöldből esetleg be is léphet autó a kereszteződésbe.
        this.terulet[this.melyikZold] = this.utak[this.melyikZold]!.mozgat(1)
        if (this.utak[this.melyikZold]!.dirty) dirty2 = 1
        if (this.terulet[this.melyikZold]) {
          const car = this.terulet[this.melyikZold]!
          const kovkanyar = car.nextturning()
          // Kereszteződésben nem sietünk: időegységenként egyet lépünk.
          car.canmove = 0
          if (!kovkanyar) {
            car.clear()
            car.allapot = AUTO_MEGHAL
            this.terulet[this.melyikZold] = null
          } else {
            if (kovkanyar === 1 || kovkanyar === 3) {
              car.visualTurns = car.visualTurns.filter(({ center }) => center.x !== this.where.x || center.y !== this.where.y)
              car.visualTurns.push({ center: { ...this.where }, incoming: car.direction, turn: kovkanyar })
            }
            switch (kovkanyar) {
              case 1:
                car.turning++
                this.kilep[this.melyikZold] = (this.melyikZold + 2) % 4
                break
              case 2:
                car.turn()
                this.kilep[this.melyikZold] = (this.melyikZold + 3) % 4
                break
              case 3:
                car.turn()
                this.kilep[this.melyikZold] = this.melyikZold
            }
          }
        }
      }

      if (!this.clock_seged) this.ido++
      this.clock_seged = 1
    }
    return dirty2
  }

  suburb() {
    if (this.melyikZold !== -1) {
      const ptr = this.utak[this.melyikZold]!.mozgat(1)
      if (ptr) {
        ptr.hatter = 0
        ptr.clear()
        ptr.allapot = AUTO_MEGHAL
      }
      return this.utak[this.melyikZold]!.dirty
    }
    return 0
  }

  Zold() { return this.melyikZold }

  // Az eredeti GRX rajzolását a React canvas-renderer végzi.
  kirajzol() {}

  // Kizárólag a renderernek szánt, számított nevek.
  get type() { return this.tipus === KERESZT_NORM ? 'normal' as const : 'edge' as const }
  get green() { return this.melyikZold }
}

export interface EngineStats {
  tick: number
  active: number
  waiting: number
  finished: number
  read: number
  total: number
}

/** VAROS.H / VAROS.CPP közvetlen TypeScript-portja. */
export class varos {
  readonly fuggUtcak: number
  readonly vizszUtcak: number
  readonly vizszUtcaHossz: number[]
  readonly fuggUtcaHossz: number[]
  readonly keresztezodesek: Kereszt[]
  readonly autokszama: number
  readonly carptr: Auto[]
  readonly autofile: AutoFile
  last = 0
  var = 0
  tickCount = 0

  constructor(readonly map: CityMap, readonly program: CarProgram) {
    this.fuggUtcak = map.columns
    this.vizszUtcak = map.rows
    this.vizszUtcaHossz = [...map.horizontalLengths]
    this.fuggUtcaHossz = [...map.verticalLengths]
    this.autokszama = program.declaredCount
    this.carptr = Array.from({ length: this.autokszama }, () => new Auto())
    this.autofile = new AutoFile(program)
    this.keresztezodesek = Array.from(
      { length: (this.fuggUtcak + 2) * (this.vizszUtcak + 2) },
      () => new Kereszt(),
    )
    this.BeallitKeresztezodesek()
  }

  private BeallitKeresztezodesek() {
    const stride = this.fuggUtcak + 2
    let sy = -1
    for (let i = 0; i < this.vizszUtcak + 2; i++) {
      let sx = -1
      for (let k = 0; k < this.fuggUtcak + 2; k++) {
        const szomszedok: Array<Kereszt | null> = [
          k !== this.fuggUtcak + 1 ? this.keresztezodesek[i * stride + k + 1] : null,
          i !== this.vizszUtcak + 1 ? this.keresztezodesek[(i + 1) * stride + k] : null,
          k ? this.keresztezodesek[i * stride + k - 1] : null,
          i ? this.keresztezodesek[(i - 1) * stride + k] : null,
        ]
        let init: Keresztezodes
        if (i > 0 && i < this.vizszUtcak + 1 && k > 0 && k < this.fuggUtcak + 1) {
          const spec = this.map.crossings[(i - 1) * this.fuggUtcak + k - 1]
          init = {
            where: { x: sx, y: sy }, szomszedok,
            periodusido: spec.period, melyikZold: spec.green, tipus: KERESZT_NORM,
            uthosszok: [
              this.fuggUtcaHossz[i], this.vizszUtcaHossz[k - 1],
              this.fuggUtcaHossz[i - 1], this.vizszUtcaHossz[k],
            ],
          }
        } else {
          const uthosszok = [0, 0, 0, 0]
          let melyikZold = -1
          if (!i) { melyikZold = 0; uthosszok[0] = this.fuggUtcaHossz[0] }
          else if (!k) { melyikZold = 3; uthosszok[3] = this.vizszUtcaHossz[0] }
          else if (i === this.vizszUtcak + 1 && k !== this.fuggUtcak + 1) {
            melyikZold = 2; uthosszok[2] = this.fuggUtcaHossz[this.vizszUtcak]
          } else if (i !== this.vizszUtcak + 1) {
            melyikZold = 1; uthosszok[1] = this.vizszUtcaHossz[this.fuggUtcak]
          }
          init = { where: { x: sx, y: sy }, szomszedok, periodusido: -1, melyikZold, tipus: KERESZT_SPEC, uthosszok }
        }
        this.keresztezodesek[i * stride + k].Beallit(init)
        if (k <= this.fuggUtcak) sx += this.vizszUtcaHossz[k] + 2
      }
      if (i <= this.vizszUtcak) sy += this.fuggUtcaHossz[i] + 2
    }
  }

  go() {
    for (const car of this.carptr) car.beginVisualStep()
    const s = (this.fuggUtcak + 2) * (this.vizszUtcak + 2) - 1
    let dirty = 1
    this.kirajzol()
    for (let i = 0; i <= s; i++) this.keresztezodesek[i].ujkor()
    // Addig vizsgáljuk újra, ameddig volt mozgás.
    while (dirty) {
      dirty = 0
      for (let i = 0; i <= s; i++) if (this.keresztezodesek[i].clock()) dirty = 1
    }
    this.beolvas()
    // Olvasás után az új autók is lépnek, amennyire tudnak.
    dirty = 1
    while (dirty) {
      dirty = 0
      for (let i = 0; i <= s; i++) if (this.keresztezodesek[i].clock()) dirty = 1
    }
    this.tickCount++
  }

  step() { this.go() }
  kirajzol() {}

  beolvas() {
    let i: number
    for (i = 0; i < this.last; i++) {
      if (this.carptr[i].allapot === AUTO_VAR && this.betesz(this.carptr[i])) {
        this.carptr[i].allapot = AUTO_MEGY
        this.var--
      }
    }
    while (this.last < this.autokszama && this.carptr[this.last].read(this.autofile)) {
      if (!this.betesz(this.carptr[this.last])) {
        this.carptr[this.last].allapot = AUTO_VAR
        this.var++
      }
      this.last++
    }
  }

  betesz(car: Auto) {
    let s = 0
    const stride = this.fuggUtcak + 2
    const position = car.position()
    if (position.x === 0) {
      for (let i = this.fuggUtcak + 3; i <= (this.vizszUtcak + 1) * stride; i += stride) {
        if (position.y === this.keresztezodesek[i].position().y + 1) s = this.keresztezodesek[i].utak[1]!.in(car)
      }
    }
    if (position.y === 0) {
      for (let i = this.fuggUtcak + 3; i <= (this.fuggUtcak + 1) * 2; i++) {
        if (position.x === this.keresztezodesek[i].position().x) s = this.keresztezodesek[i].utak[2]!.in(car)
      }
    }
    if (position.x === this.map.width + 1) {
      for (let i = (this.fuggUtcak + 1) * 2; i <= (this.vizszUtcak + 2) * (this.fuggUtcak + 1) - 1; i += stride) {
        if (position.y === this.keresztezodesek[i].position().y) s = this.keresztezodesek[i].utak[3]!.in(car)
      }
    }
    if (position.y === this.map.height + 1) {
      for (let i = stride * this.vizszUtcak + 1; i <= (this.vizszUtcak + 1) * stride - 2; i++) {
        if (position.x === this.keresztezodesek[i].position().x + 1) s = this.keresztezodesek[i].utak[0]!.in(car)
      }
    }
    return s
  }

  get cars() { return this.carptr }
  get intersections() { return this.keresztezodesek }
  get xCrossings() { return this.keresztezodesek.filter((k) => k.tipus === KERESZT_NORM && k.where.y === this.keresztezodesek.find((n) => n.tipus === KERESZT_NORM)?.where.y).map((k) => k.where.x) }
  get yCrossings() { return [...new Set(this.keresztezodesek.filter((k) => k.tipus === KERESZT_NORM).map((k) => k.where.y))] }

  stats(): EngineStats {
    return {
      tick: this.tickCount,
      active: this.carptr.filter((car) => car.allapot === AUTO_MEGY).length,
      waiting: this.var,
      finished: this.carptr.filter((car) => car.allapot === AUTO_MEGHAL).length,
      read: this.last,
      total: this.autokszama,
    }
  }
}

// A React-réteg régi importneve; maga a motor az eredeti `varos` osztály.
export { varos as CityEngine }
export type Car = Auto

/** Tesztsegéd: egyetlen régi autórekordból Auto készítése. */
export function autoFromSpec(spec: CarSpec) {
  const auto = new Auto()
  auto.speed = spec.speed
  auto.where = { x: spec.x, y: spec.y }
  auto.direction = spec.direction
  auto.color = spec.color
  auto.route = [...spec.route, 0]
  auto.canmove = spec.speed
  auto.allapot = AUTO_MEGY
  return auto
}
