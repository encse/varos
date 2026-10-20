import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { CityEngine, PALETTE, type Car, type Kereszt } from './engine'
import { carPoseAt, LANE_INSET } from './motion'
import { isParkBlock } from './scenery'
import { Seagulls } from './seagulls'
import { CAR_APPEARANCES } from './carAppearance'

type Signal = { red: THREE.Mesh; green: THREE.Mesh; node: Kereszt; direction: number }
type ParkProp = { template: THREE.Object3D; file: typeof PARK_PROP_FILES[number] }
type ModelProp = { template: THREE.Object3D }
type YardFootprint = { x: number; z: number; width: number; depth: number }

const BUILDING_FILES = [
  ...'abcdefghijklmn'.split('').map((letter) => `building-${letter}`),
  ...'abcde'.split('').map((letter) => `building-skyscraper-${letter}`),
]
const TREE_FILES = [
  'tree-default', 'tree-oak', 'tree-small', 'tree_detailed', 'tree_fat',
  'tree_tall', 'tree_thin', 'tree_blocks', 'tree_cone',
]
const PARK_PROP_FILES = [
  'plant_bushDetailed', 'plant_bushSmall',
  'flower_redA', 'flower_purpleB', 'flower_yellowC',
  'grass', 'grass_leafs', 'mushroom_redGroup', 'mushroom_tanGroup',
  'rock_smallA', 'rock_smallF', 'stump_roundDetailed', 'log', 'sign',
  'statue_block', 'statue_column',
] as const
const MINI_SKATE_FILES = [
  'half-pipe', 'structure-wood-platform', 'bowl-corner-inner', 'rail-high',
] as const

const ROAD_Y = 0
const ROAD_DETAIL_Y = 0.004
const MODEL_ROAD_TOP_Y = 0.041
const YARD_HEIGHT = MODEL_ROAD_TOP_Y
const YARD_TOP_Y = YARD_HEIGHT
// A díszmodellek talpa kissé fusson bele a gyepbe. A puszta felületi érintkezés
// a low-poly talpaknál és az árnyék bias mellett lebegő résnek látszik.
const SCENERY_BASE_Y = YARD_TOP_Y - 0.025
// A Kenney csomagok eltérő forrásegységekkel készültek (például az útmodul
// 1 egység, egy autó 2.55 egység hosszú). Csomagonként egyszer átváltjuk őket
// a város közös méterrendszerébe; ezután minden modell ugyanazt a világskálát
// kapja, és egyetlen példányt sem méretezünk külön a befoglaló dobozához.
const WORLD_ASSET_SCALE = 1
const SOURCE_SCALE = {
  commercial: 1.55,
  cars: 0.3,
  nature: 1.15,
  roads: 2,
  skate: 0.45,
} as const

/**
 * A C++ szimuláció változatlan állapotát megjelenítő low-poly WebGL-réteg.
 * Nem mozgat autót és nem számol forgalmat: kizárólag az Auto/Kereszt adatokat olvassa.
 */
export class City3DRenderer {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 500)
  private readonly controls: OrbitControls
  private readonly staticGroup = new THREE.Group()
  private readonly carGroup = new THREE.Group()
  private readonly carClippingPlanes = [
    new THREE.Plane(new THREE.Vector3(1, 0, 0)),
    new THREE.Plane(new THREE.Vector3(-1, 0, 0)),
    new THREE.Plane(new THREE.Vector3(0, 0, 1)),
    new THREE.Plane(new THREE.Vector3(0, 0, -1)),
  ]
  private readonly seagulls = new Seagulls()
  private readonly animationStartedAt = performance.now()
  private readonly signals: Signal[] = []
  private readonly engravingTextures: THREE.CanvasTexture[] = []
  private readonly resizeObserver: ResizeObserver
  private engine: CityEngine
  private disposed = false
  private buildingModels: THREE.Object3D[] = []
  private carModels: THREE.Object3D[] = []
  private treeModels: THREE.Object3D[] = []
  private parkProps: ParkProp[] = []
  private miniSkateProps: ModelProp[] = []
  private roadStraightModel: THREE.Object3D | null = null
  private roadStraightHalfModel: THREE.Object3D | null = null
  private roadCrossroadModel: THREE.Object3D | null = null
  private trafficLightModel: THREE.Object3D | null = null
  private carInstances = new WeakMap<Car, THREE.Object3D>()
  private progress = 1

  // Alaphelyzetben a 2-es irányba (+Z, lefelé a régi térképen) néz.
  private readonly carBody = new THREE.BoxGeometry(0.46, 0.24, 0.76)
  private readonly carCabin = makeCabinGeometry()
  private readonly wheel = new THREE.CylinderGeometry(0.1, 0.1, 0.09, 6)
  private readonly signalBulb = new THREE.CircleGeometry(0.046, 10)
  private readonly redSignal = new THREE.MeshStandardMaterial({ color: PALETTE[9], emissive: PALETTE[9], emissiveIntensity: 1.25 })
  private readonly greenSignal = new THREE.MeshStandardMaterial({ color: PALETTE[11], emissive: PALETTE[11], emissiveIntensity: 1.25 })
  private readonly offRedSignal = new THREE.MeshStandardMaterial({ color: '#522321', roughness: 0.9 })
  private readonly offGreenSignal = new THREE.MeshStandardMaterial({ color: '#21472d', roughness: 0.9 })
  private readonly amberSignal = new THREE.MeshStandardMaterial({ color: '#806d27', roughness: 0.9 })
  private readonly carMaterials = PALETTE.map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.72, flatShading: true }))
  private readonly cabinMaterial = new THREE.MeshStandardMaterial({ color: '#9fb3b8', roughness: 0.38, metalness: 0.12, flatShading: true })
  private readonly wheelMaterial = new THREE.MeshStandardMaterial({ color: '#11110f', roughness: 1 })

  get backendName() {
    return this.renderer.capabilities.isWebGL2 ? 'WEBGL 2' : 'WEBGL 1'
  }

  constructor(
    private readonly canvas: HTMLCanvasElement,
    engine: CityEngine,
    context: WebGLRenderingContext | WebGL2RenderingContext,
  ) {
    this.engine = engine
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      context,
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.localClippingEnabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.scene.background = new THREE.Color('#171918')
    this.scene.add(this.staticGroup, this.carGroup, this.seagulls.group)

    const hemisphere = new THREE.HemisphereLight('#d8edf0', '#3e3025', 2.15)
    const sun = new THREE.DirectionalLight('#fff0c2', 3.5)
    sun.position.set(-20, 30, -16)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.camera.left = -35
    sun.shadow.camera.right = 35
    sun.shadow.camera.top = 35
    sun.shadow.camera.bottom = -35
    // A sűrűn triangulált Kenney tetőkön és homlokzatokon shadow acne nélkül
    // maradjon egybefüggő az árnyalás.
    sun.shadow.normalBias = 0.045
    sun.shadow.bias = -0.00025
    this.scene.add(hemisphere, sun)

    const size = Math.max(engine.map.width, engine.map.height)
    // Oldalnézetes, makettszerű alapbeállítás: a talapzat oldala is látszik.
    this.camera.position.set(size * 0.9, size * 0.58, size * 1.02)
    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.target.set(0, 0.65, 0)
    this.controls.enableDamping = false
    this.controls.autoRotate = false
    this.controls.minDistance = Math.max(8, size * 0.3)
    this.controls.maxDistance = Math.max(35, size * 2.8)
    this.controls.minPolarAngle = Math.PI * 0.2
    this.controls.maxPolarAngle = Math.PI * 0.47
    this.controls.addEventListener('change', this.draw)
    this.controls.update()

    this.buildCity()
    this.resizeObserver = new ResizeObserver(this.resize)
    this.resizeObserver.observe(canvas.parentElement ?? canvas)
    this.resize()
    this.update(engine)
    this.renderer.setAnimationLoop(this.animateScenery)
    void this.loadKenneyModels()
  }

  update(engine: CityEngine, progress = 1) {
    this.progress = progress
    if (engine !== this.engine) {
      this.engine = engine
      this.clearGroup(this.staticGroup, true)
      this.clearGroup(this.carGroup, false)
      this.carInstances = new WeakMap()
      this.signals.length = 0
      this.buildCity()
    }
    this.updateSignals()
    this.updateCars(progress)
    this.draw()
  }

  private async loadKenneyModels() {
    const loader = new GLTFLoader()
    const base = `${import.meta.env.BASE_URL}models/kenney`
    const buildingFiles = BUILDING_FILES.map((name) => `${base}/commercial/${name}.glb`)
    const carFiles = CAR_APPEARANCES.map(({ model }) => `${base}/cars/${model}.glb`)
    const treeFiles = TREE_FILES.map((name) => `${base}/nature/${name}.glb`)
    const parkPropFiles = PARK_PROP_FILES.map((file) => `${base}/nature/${file}.glb`)
    const miniSkateFiles = MINI_SKATE_FILES.map((file) => `${base}/mini-skate/${file}.glb`)
    // Egy hibás díszletfájl ne dobja el az autókat, házakat és lámpákat is.
    const results = await Promise.allSettled([
      Promise.all(buildingFiles.map((url) => loader.loadAsync(url))),
      Promise.all(carFiles.map((url) => loader.loadAsync(url))),
      Promise.all(treeFiles.map((url) => loader.loadAsync(url))),
      Promise.all(parkPropFiles.map((url) => loader.loadAsync(url))),
      Promise.all(miniSkateFiles.map((url) => loader.loadAsync(url))),
      Promise.all([
        loader.loadAsync(`${base}/roads/road-straight.glb`),
        loader.loadAsync(`${base}/roads/road-straight-half.glb`),
        loader.loadAsync(`${base}/roads/road-crossroad-path.glb`),
      ]),
      loader.loadAsync(`${base}/roads/traffic-light.glb`),
    ])
    if (this.disposed) return

    const [buildings, cars, trees, parkDetails, miniSkate, roads, trafficLight] = results
    if (buildings.status === 'fulfilled') {
      this.buildingModels = buildings.value.map(({ scene }) => this.prepareTemplate(scene))
    }
    if (cars.status === 'fulfilled') {
      this.carModels = cars.value.map(({ scene }) => this.prepareTemplate(scene))
    }
    if (trees.status === 'fulfilled') {
      this.treeModels = trees.value.map(({ scene }) => this.prepareNatureTemplate(scene))
    }
    if (parkDetails.status === 'fulfilled') {
      this.parkProps = parkDetails.value.map(({ scene }, index) => ({
        template: this.prepareNatureTemplate(scene),
        file: PARK_PROP_FILES[index],
      }))
    }
    if (miniSkate.status === 'fulfilled') {
      this.miniSkateProps = miniSkate.value.map(({ scene }) => ({
        template: this.prepareTemplate(scene),
      }))
    }
    if (roads.status === 'fulfilled') {
      this.roadStraightModel = this.prepareRoadTemplate(roads.value[0].scene)
      this.roadStraightHalfModel = this.prepareRoadTemplate(roads.value[1].scene)
      this.roadCrossroadModel = this.prepareRoadTemplate(roads.value[2].scene)
    }
    if (trafficLight.status === 'fulfilled') {
      this.trafficLightModel = this.prepareTemplate(trafficLight.value.scene)
    }

    results.forEach((result, index) => {
      if (result.status === 'rejected') console.warn(`A(z) ${['épület', 'autó', 'fa', 'parkdísz', 'skatepark', 'út', 'lámpa'][index]} modellek nem tölthetők be.`, result.reason)
    })

    this.clearGroup(this.staticGroup, true)
    this.clearGroup(this.carGroup, false)
    this.carInstances = new WeakMap()
    this.signals.length = 0
    this.buildCity()
    this.updateSignals()
    this.updateCars(this.progress)
    this.draw()
  }

  private prepareTemplate(scene: THREE.Object3D) {
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      // A Kenney natív GLB-jei kész normálokat, tangenseket és paletta-UV-ket
      // tartalmaznak. A hivatalos útmutató szerint ezeket nem szabad importkor
      // újraszámolni; a GLTFLoader változtatás nélkül használja őket.
      object.castShadow = true
      object.receiveShadow = true
    })
    return scene
  }

  private prepareNatureTemplate(scene: THREE.Object3D) {
    this.prepareTemplate(scene)
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.forEach((material) => {
        if (!(material instanceof THREE.MeshStandardMaterial)) return
        // A régebbi Kenney Nature Kit GLB-k a leveleket és a fát is teljesen
        // fémesként exportálták. Env map nélkül ettől az árnyékos oldal fekete.
        material.metalness = 0
        material.roughness = 1
        if (/leaf/i.test(material.name)) material.color.set('#2f9b57')
        material.needsUpdate = true
      })
    })
    return scene
  }

  private prepareRoadTemplate(scene: THREE.Object3D) {
    this.prepareTemplate(scene)
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      object.castShadow = false
      object.receiveShadow = true
    })
    return scene
  }

  private buildingModel(template: THREE.Object3D) {
    return this.nativeModel(template, SOURCE_SCALE.commercial)
  }

  private nativeModel(template: THREE.Object3D, sourceScale: number) {
    const model = template.clone(true)
    const bounds = new THREE.Box3().setFromObject(model)
    const center = bounds.getCenter(new THREE.Vector3())
    const scale = sourceScale * WORLD_ASSET_SCALE
    model.scale.setScalar(scale)
    model.position.set(
      -center.x * scale,
      -bounds.min.y * scale,
      -center.z * scale,
    )
    const group = new THREE.Group()
    group.userData.sharedAsset = true
    group.add(model)
    return group
  }

  private buildCity() {
    const { map } = this.engine
    this.engravingTextures.forEach((texture) => texture.dispose())
    this.engravingTextures.length = 0
    this.carClippingPlanes[0].constant = this.carClippingPlanes[1].constant = map.width / 2
    this.carClippingPlanes[2].constant = this.carClippingPlanes[3].constant = map.height / 2
    const asphalt = new THREE.MeshStandardMaterial({ color: PALETTE[12], roughness: 1, flatShading: true })

    // Vastag, látható makettalap: ettől lesz valódi dioráma, nem lebegő térkép.
    const pedestal = new THREE.Mesh(
      new THREE.BoxGeometry(map.width + 4.8, 1.05, map.height + 4.8),
      new THREE.MeshStandardMaterial({ color: '#5b4b3d', roughness: 0.94, flatShading: true }),
    )
    pedestal.position.y = -0.62
    pedestal.castShadow = true
    pedestal.receiveShadow = true
    this.staticGroup.add(pedestal)

    // A gyep körül szabadon hagyott felső faperemre kerülnek az égtájak.
    for (const { label, x, z } of [
      { label: 'É', x: 0, z: -map.height / 2 - 1.87 },
      { label: 'K', x: map.width / 2 + 1.87, z: 0 },
      { label: 'D', x: 0, z: map.height / 2 + 1.87 },
      { label: 'NY', x: -map.width / 2 - 1.87, z: 0 },
    ]) {
      const engraving = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), this.engravedLabel(label))
      engraving.rotation.x = -Math.PI / 2
      engraving.position.set(x, -0.094, z)
      engraving.receiveShadow = true
      this.staticGroup.add(engraving)
    }

    const lowerBase = new THREE.Mesh(
      new THREE.BoxGeometry(map.width + 5.7, 0.22, map.height + 5.7),
      new THREE.MeshStandardMaterial({ color: '#272521', roughness: 1, flatShading: true }),
    )
    lowerBase.position.y = -1.19
    lowerBase.castShadow = true
    lowerBase.receiveShadow = true
    this.staticGroup.add(lowerBase)

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(map.width + 2.7, map.height + 2.7), new THREE.MeshStandardMaterial({ color: '#69725d', roughness: 1, flatShading: true }))
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.075
    ground.receiveShadow = true
    this.staticGroup.add(ground)

    const road = new THREE.Mesh(new THREE.PlaneGeometry(map.width, map.height), asphalt)
    road.rotation.x = -Math.PI / 2
    // A modellutak alatt marad egy folytonos aszfaltréteg, de kissé lejjebb,
    // hogy a GLB-k alsó síkjával ne villogjon össze.
    road.position.y = ROAD_Y - 0.006
    road.receiveShadow = true
    this.staticGroup.add(road)

    let top = 0
    map.verticalLengths.forEach((blockHeight, row) => {
      let left = 0
      map.horizontalLengths.forEach((blockWidth, column) => {
        this.addBlock(left, top, blockWidth, blockHeight, row, column)
        left += blockWidth + 2
      })
      top += blockHeight + 2
    })
    if (this.roadStraightModel && this.roadStraightHalfModel && this.roadCrossroadModel) this.addModelRoads()
    else this.addRoadMarkings()
    this.addTrafficLights()
    this.seagulls.setBounds(map.width, map.height, new THREE.Box3().setFromObject(this.staticGroup).max.y)
    this.seagulls.update((performance.now() - this.animationStartedAt) / 1000)
  }

  private engravedLabel(label: string) {
    const canvas = document.createElement('canvas')
    canvas.height = 128
    canvas.width = 128
    const context = canvas.getContext('2d')!
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.font = 'bold 70px Georgia, serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillStyle = '#62584d'
    context.fillText(label, canvas.width / 2, canvas.height / 2 + 2)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy()
    this.engravingTextures.push(texture)
    return new THREE.MeshStandardMaterial({
      color: '#5b4b3d', roughness: 0.94, flatShading: true,
      map: texture, bumpMap: texture, bumpScale: 0.045,
    })
  }

  private addBlock(left: number, top: number, width: number, height: number, row: number, column: number) {
    const { map } = this.engine
    const yard = new THREE.Mesh(
      new THREE.BoxGeometry(width, YARD_HEIGHT, height),
      new THREE.MeshStandardMaterial({ color: '#73806b', roughness: 1, flatShading: true }),
    )
    yard.position.set(
      left + width / 2 - map.width / 2,
      YARD_HEIGHT / 2,
      top + height / 2 - map.height / 2,
    )
    yard.receiveShadow = true
    this.staticGroup.add(yard)

    if (isParkBlock(row, column, width, height)) {
      this.addPark(left, top, width, height, row, column)
      return
    }

    if (this.buildingModels.length) {
      this.addKenneyBuildingBlock(left, top, width, height, row, column)
      return
    }

    const countX = width >= 6 ? 2 : 1
    const countZ = height >= 6 ? 2 : 1
    for (let z = 0; z < countZ; z++) {
      for (let x = 0; x < countX; x++) {
        // A nagy prímszámok a szomszédos telkeken is más, de reprodukálható
        // épülettípust, magasságot és homlokzati irányt adnak.
        const hash = (((row + 1) * 73856093) ^ ((column + 1) * 19349663) ^ ((x + 1) * 83492791) ^ ((z + 1) * 2654435761)) >>> 0
        const cellW = width / countX
        const cellH = height / countZ
        const buildingWidth = Math.max(0.8, cellW - 0.92)
        const buildingDepth = Math.max(0.8, cellH - 0.92)
        const buildingHeight = 0.9 + (hash % 6) * 0.42
        const colors = ['#b5ae99', '#9ca89d', '#b59c8b', '#8e9ba4', '#afa9b8']
        const material = new THREE.MeshStandardMaterial({ color: colors[hash % colors.length], roughness: 0.88, flatShading: true })
        const building = new THREE.Mesh(new THREE.BoxGeometry(buildingWidth, buildingHeight, buildingDepth), material)
        building.position.set(
          left + (x + 0.5) * cellW - map.width / 2,
          YARD_TOP_Y + buildingHeight / 2,
          top + (z + 0.5) * cellH - map.height / 2,
        )
        building.castShadow = true
        building.receiveShadow = true
        this.staticGroup.add(building)

        if (hash % 3 === 0 || buildingHeight < 1.5) {
          const roof = new THREE.Mesh(
            new THREE.ConeGeometry(Math.min(buildingWidth, buildingDepth) * 0.48, 0.45, 4),
            new THREE.MeshStandardMaterial({ color: '#675750', roughness: 1, flatShading: true }),
          )
          roof.rotation.y = Math.PI / 4
          roof.position.set(building.position.x, YARD_TOP_Y + buildingHeight + 0.23, building.position.z)
          roof.castShadow = true
          this.staticGroup.add(roof)
        } else {
          const roof = new THREE.Mesh(
            new THREE.BoxGeometry(buildingWidth + 0.08, 0.11, buildingDepth + 0.08),
            new THREE.MeshStandardMaterial({ color: '#5b5d57', roughness: 1, flatShading: true }),
          )
          roof.position.set(building.position.x, YARD_TOP_Y + buildingHeight + 0.055, building.position.z)
          this.staticGroup.add(roof)
        }
        this.addFacadeDetails(building.position.x, YARD_TOP_Y, building.position.z, buildingWidth, buildingHeight, buildingDepth)
      }
    }
  }

  private addKenneyBuildingBlock(left: number, top: number, width: number, height: number, row: number, column: number) {
    const seed = (((row + 1) * 73856093) ^ ((column + 1) * 19349663)) >>> 0
    const occupied: YardFootprint[] = []
    const narrow = [0, 1, 2, 3, 5, 6, 7, 8]
    const wide = [9, 10]
    const deep = [11, 12, 13]
    const towers = [14, 15, 16, 17, 18]
    const pick = (indices: number[], salt: number) => indices[(seed + salt * 2654435761) % indices.length]
    const place = (
      modelIndex: number,
      localX: number,
      localZ: number,
      footprintWidth: number,
      footprintDepth: number,
      rotation: number,
      _maxHeight: number,
    ) => {
      const model = this.buildingModel(this.buildingModels[modelIndex])
      model.position.set(
        left + localX - this.engine.map.width / 2,
        YARD_TOP_Y,
        top + localZ - this.engine.map.height / 2,
      )
      // A Kenney commercial modellek utcai homlokzata alaphelyzetben a -Z
      // iranyba nez. A blokk kiosztasa viszont +Z eleju forgatasokat szamol,
      // ezert minden haznal ugyanaz a fel fordulat kell a tenyleges utcafronthoz.
      model.rotation.y = rotation + Math.PI
      this.staticGroup.add(model)

      // A modellek aranytartóan vannak méretezve, ezért a megadott befoglaló
      // téglalapnál gyakran jóval kisebb a valódi alapterületük. A kertet a
      // tényleges, elforgatott befoglaló doboz alapján rendezzük be.
      model.updateWorldMatrix(true, true)
      const actualSize = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3())
      occupied.push({ x: localX, z: localZ, width: actualSize.x, depth: actualSize.z })
    }
    const decorate = () => this.addBuildingYardDetails(left, top, width, height, seed, occupied)

    if (width >= 6 && height >= 6 && seed % 5 === 0) {
      // Tornyos belső udvar: a magas épület körül négy külön keskeny ház.
      place(pick(towers, 0), width / 2, height / 2, 1.9, 1.9, 0, 5.2)
      const corners = [
        [1.05, 1.05, Math.PI],
        [width - 1.05, 1.05, Math.PI / 2],
        [width - 1.05, height - 1.05, 0],
        [1.05, height - 1.05, -Math.PI / 2],
      ] as const
      corners.forEach(([x, z, rotation], index) => {
        place(pick(narrow, index + 1), x, z, 1.25, 1.25, rotation, 2.7)
      })
      decorate()
      return
    }

    if (width >= 6 && height >= 6) {
      // Egy teljes 1×N utcafront, mögötte egy L alakú sarokház és egy
      // keskeny sorházi záróelem. A sablon blokkonként negyedet fordulhat.
      const vertical = seed % 2 === 1
      const farSide = seed % 4 >= 2
      if (!vertical) {
        const rowZ = farSide ? height * 0.75 : height * 0.25
        const edgeRotation = farSide ? 0 : Math.PI
        const otherZ = farSide ? height * 0.25 : height * 0.75
        place(pick(wide, 1), width / 2, rowZ, width - 0.9, height / 2 - 0.8, edgeRotation, 3.7)
        const cornerOnRight = seed % 8 >= 4
        place(4, cornerOnRight ? width * 0.75 : width * 0.25, otherZ, width / 2 - 0.7, height / 2 - 0.7, farSide ? Math.PI : 0, 3.1)
        place(pick(narrow, 2), cornerOnRight ? width * 0.25 : width * 0.75, otherZ, width / 2 - 1.0, height / 2 - 0.85, farSide ? Math.PI : 0, 3.25)
      } else {
        const columnX = farSide ? width * 0.75 : width * 0.25
        const edgeRotation = farSide ? Math.PI / 2 : -Math.PI / 2
        const otherX = farSide ? width * 0.25 : width * 0.75
        place(pick(wide, 1), columnX, height / 2, width / 2 - 0.8, height - 0.9, edgeRotation, 3.7)
        const cornerAtBottom = seed % 8 >= 4
        const oppositeRotation = farSide ? -Math.PI / 2 : Math.PI / 2
        place(4, otherX, cornerAtBottom ? height * 0.75 : height * 0.25, width / 2 - 0.7, height / 2 - 0.7, oppositeRotation, 3.1)
        place(pick(narrow, 2), otherX, cornerAtBottom ? height * 0.25 : height * 0.75, width / 2 - 0.85, height / 2 - 1.0, oppositeRotation, 3.25)
      }
      decorate()
      return
    }

    // Keskeny blokkokon egyetlen, a hosszabb oldalhoz választott épület áll.
    const alongX = width >= height
    const candidates = alongX && width >= 4.5 ? wide : height >= 4.5 ? deep : narrow
    const rotation = alongX ? (seed % 2 ? 0 : Math.PI) : (seed % 2 ? Math.PI / 2 : -Math.PI / 2)
    place(
      pick(candidates, 3),
      width / 2,
      height / 2,
      Math.max(0.8, width - 0.9),
      Math.max(0.8, height - 0.9),
      rotation,
      candidates === narrow ? 3.0 : 3.8,
    )
    decorate()
  }

  private addBuildingYardDetails(
    left: number,
    top: number,
    width: number,
    height: number,
    seed: number,
    occupied: YardFootprint[],
  ) {
    const { map } = this.engine
    const margin = 0.55
    const candidates = [
      [margin, margin], [width - margin, margin],
      [margin, height - margin], [width - margin, height - margin],
      [width / 2, margin], [width / 2, height - margin],
      [margin, height / 2], [width - margin, height / 2],
    ] as const
    const free = candidates
      .map((_, index) => candidates[(index + seed) % candidates.length])
      .filter(([x, z]) => occupied.every((building) => (
        Math.abs(x - building.x) > building.width / 2 + 0.3
        || Math.abs(z - building.z) > building.depth / 2 + 0.3
      )))
      .slice(0, 4)

    free.forEach(([localX, localZ], index) => {
      const x = left + localX - map.width / 2
      const z = top + localZ - map.height / 2
      if (index % 2 === 0 && this.treeModels.length) {
        const tree = this.nativeModel(
          this.treeModels[(seed + index * 5) % this.treeModels.length],
          SOURCE_SCALE.nature,
        )
        tree.position.set(x, SCENERY_BASE_Y, z)
        tree.rotation.y = ((seed + index * 3) % 8) * Math.PI / 4
        this.staticGroup.add(tree)
      } else {
        const distances = [localZ, width - localX, height - localZ, localX]
        const nearestEdge = distances.indexOf(Math.min(...distances))
        this.addBench(x, z, [0, -Math.PI / 2, Math.PI, Math.PI / 2][nearestEdge])
      }
    })
  }

  private addPark(left: number, top: number, width: number, height: number, row: number, column: number) {
    const { map } = this.engine
    const centerX = left + width / 2 - map.width / 2
    const centerZ = top + height / 2 - map.height / 2
    const pathMaterial = new THREE.MeshStandardMaterial({ color: '#c7b98f', roughness: 1, flatShading: true })
    const horizontalPath = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.8, width - 0.72), 0.035, 0.34), pathMaterial)
    const verticalPath = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.036, Math.max(0.8, height - 0.72)), pathMaterial)
    horizontalPath.position.set(centerX, YARD_TOP_Y + 0.0175, centerZ)
    verticalPath.position.set(centerX, YARD_TOP_Y + 0.018, centerZ)
    horizontalPath.receiveShadow = true
    verticalPath.receiveShadow = true
    this.staticGroup.add(horizontalPath, verticalPath)

    const seed = row * 37 + column * 19 + 13
    const skateParkSize = SOURCE_SCALE.skate * WORLD_ASSET_SCALE * 3
    const skateParkX = centerX + (seed % 2 ? 1 : -1) * width * 0.22
    const skateParkZ = centerZ - height * 0.22
    const hasSkatePark = this.miniSkateProps.length === MINI_SKATE_FILES.length && width >= 4 && height >= 4
    const overlapsSkatePark = (x: number, z: number, padding: number) => hasSkatePark
      && Math.abs(x - skateParkX) < skateParkSize / 2 + padding
      && Math.abs(z - skateParkZ) < skateParkSize / 2 + padding

    if (hasSkatePark) this.addMiniSkatePark(skateParkX, skateParkZ, skateParkSize)

    const treeSpots = [
      [-0.31, -0.31], [0, -0.34], [0.31, -0.3],
      [-0.34, 0.02], [0.34, 0.03],
      [-0.3, 0.31], [0.02, 0.34], [0.31, 0.29],
    ]
    treeSpots.forEach(([factorX, factorZ], index) => {
      const x = centerX + factorX * Math.max(1.4, width - 0.7)
      const z = centerZ + factorZ * Math.max(1.4, height - 0.7)
      if (overlapsSkatePark(x, z, 0.22)) return
      if (this.treeModels.length) {
        const tree = this.nativeModel(
          this.treeModels[(seed + index * 5) % this.treeModels.length],
          SOURCE_SCALE.nature,
        )
        tree.position.set(x, SCENERY_BASE_Y, z)
        tree.rotation.y = ((seed + index * 3) % 8) * Math.PI / 4
        this.staticGroup.add(tree)
      } else {
        this.addFallbackTree(x, z, 1.7 + (index % 3) * 0.16)
      }
    })

    if (this.parkProps.length) {
      // Apró részletek a kereszt alakú sétány négy negyedében és a szélein.
      // A sorrend determinisztikus, így ugyanahhoz az inputhoz ugyanaz a park jár.
      const detailSpots = [
        [-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2],
        [-0.39, -0.15], [0.39, 0.15], [-0.15, 0.39], [0.15, -0.39],
        [-0.36, 0.34], [0.36, -0.34], [-0.34, -0.37], [0.34, 0.37],
      ]
      detailSpots.forEach(([factorX, factorZ], index) => {
        const detail = this.parkProps[(seed * 3 + index * 7) % this.parkProps.length]
        const x = centerX + factorX * Math.max(1.4, width - 0.55)
        const z = centerZ + factorZ * Math.max(1.4, height - 0.55)
        if (detail.file.startsWith('flower_')) {
          if (overlapsSkatePark(x, z, 0.5)) return
          this.addFlowerPatch(x, z, seed + index)
          return
        }
        if (overlapsSkatePark(x, z, 0.08)) return
        const model = this.nativeModel(detail.template, SOURCE_SCALE.nature)
        model.position.set(x, YARD_TOP_Y, z)
        model.rotation.y = ((seed + index * 3) % 8) * Math.PI / 4
        this.staticGroup.add(model)
      })
    }

    // A Nature Kitben nincs pad; egyszerű low-poly pad egészíti ki a valódi növényzetet.
    for (const side of [-1, 1]) {
      this.addBench(
        centerX + side * width * 0.23,
        centerZ + height * 0.06,
        side < 0 ? Math.PI / 2 : -Math.PI / 2,
      )
    }
  }

  private addFlowerPatch(x: number, z: number, seed: number) {
    const flowers = this.parkProps.filter(({ file }) => file.startsWith('flower_'))
    if (!flowers.length) return

    const patch = new THREE.Group()
    const soil = new THREE.Mesh(
      new THREE.CylinderGeometry(0.46, 0.48, 0.025, 12),
      new THREE.MeshStandardMaterial({ color: '#5d4b38', roughness: 1, flatShading: true }),
    )
    soil.scale.z = 0.92
    soil.position.y = 0.0125
    soil.receiveShadow = true
    patch.add(soil)

    // Közel egy teljes 1 x 1-es városi egységet kitöltő, szabálytalan ágyás.
    const spots = [
      [0, 0], [-0.15, -0.08], [0.15, -0.1], [-0.18, 0.1], [0.18, 0.09],
      [-0.03, 0.19], [0.03, -0.2], [-0.31, -0.12], [0.3, -0.13],
      [-0.31, 0.14], [0.31, 0.14], [-0.13, 0.33], [0.14, -0.34],
    ] as const
    spots.forEach(([flowerX, flowerZ], index) => {
      const flower = flowers[(seed + index * 2) % flowers.length]
      const model = this.nativeModel(flower.template, SOURCE_SCALE.nature)
      model.position.set(flowerX, 0.025, flowerZ)
      model.rotation.y = ((seed + index * 3) % 8) * Math.PI / 4
      patch.add(model)
    })

    patch.position.set(x, YARD_TOP_Y, z)
    patch.rotation.y = (seed % 8) * Math.PI / 4
    this.staticGroup.add(patch)
  }

  private addBench(x: number, z: number, rotation: number) {
    const bench = new THREE.Group()
    const wood = new THREE.MeshStandardMaterial({ color: '#76523b', roughness: 0.95, flatShading: true })
    const dark = new THREE.MeshStandardMaterial({ color: '#292d29', roughness: 1, flatShading: true })
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.055, 0.13), wood)
    seat.position.y = 0.15
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.17, 0.045), wood)
    back.position.set(0, 0.23, -0.05)
    const legs = [-0.13, 0.13].map((legX) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.14, 0.09), dark)
      leg.position.set(legX, 0.07, 0)
      return leg
    })
    bench.add(seat, back, ...legs)
    bench.position.set(x, SCENERY_BASE_Y, z)
    bench.rotation.y = rotation
    bench.traverse((object) => { if (object instanceof THREE.Mesh) object.castShadow = true })
    this.staticGroup.add(bench)
  }

  private addMiniSkatePark(x: number, z: number, size: number) {
    const group = new THREE.Group()
    const cell = size / 3
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(size, 0.035, cell * 2.25),
      new THREE.MeshStandardMaterial({ color: '#686777', roughness: 0.94, flatShading: true }),
    )
    pad.position.y = 0.0175
    pad.receiveShadow = true
    group.add(pad)

    // A teljes kompozíció 3 x 2 gyári modul: balra egy 2 x 2-es bowl,
    // jobbra két egymás felé nyitott negyedcsőből összeálló valódi félcső.
    const place = (modelIndex: number, localX: number, localZ: number, rotation: number, baseY = 0.036) => {
      const prop = this.miniSkateProps[modelIndex]
      const model = this.nativeModel(prop.template, SOURCE_SCALE.skate)
      model.position.set(localX, baseY, localZ)
      model.rotation.y = rotation
      group.add(model)
    }

    place(2, -cell, -cell / 2, 0)
    place(2, 0, -cell / 2, -Math.PI / 2)
    place(2, 0, cell / 2, Math.PI)
    place(2, -cell, cell / 2, Math.PI / 2)

    // A modell nyitott oldala alaphelyzetben +Z. Az északi darab ezért
    // alaphelyzetű, a délit fél fordulattal tükrözzük: a két ív középre fut.
    place(0, cell, -cell / 2, 0)
    place(0, cell, cell / 2, Math.PI)

    group.position.set(x, YARD_TOP_Y + 0.003, z)
    // A skate-rész mindig ugyanabban a helyi tájolásban marad, így az elemek
    // összeillesztése nem fordulhat szét a park magja körül.
    group.rotation.y = 0
    this.staticGroup.add(group)
  }

  private addFallbackTree(x: number, z: number, height: number) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.1, height * 0.48, 6),
      new THREE.MeshStandardMaterial({ color: '#74513c', roughness: 1, flatShading: true }),
    )
    const crown = new THREE.Mesh(
      new THREE.IcosahedronGeometry(height * 0.34, 0),
      new THREE.MeshStandardMaterial({ color: '#43865d', roughness: 1, flatShading: true }),
    )
    trunk.position.set(x, SCENERY_BASE_Y + height * 0.24, z)
    crown.position.set(x, SCENERY_BASE_Y + height * 0.7, z)
    trunk.castShadow = true
    crown.castShadow = true
    this.staticGroup.add(trunk, crown)
  }

  private addFacadeDetails(x: number, baseY: number, z: number, width: number, height: number, depth: number) {
    const glass = new THREE.MeshStandardMaterial({ color: '#9fb2ae', roughness: 0.4, metalness: 0.08, flatShading: true })
    const floors = Math.max(1, Math.min(4, Math.floor(height / 0.58)))
    for (let floor = 0; floor < floors; floor++) {
      const y = baseY + 0.36 + floor * 0.56
      if (y > baseY + height - 0.14) break
      const front = new THREE.Mesh(new THREE.BoxGeometry(width * 0.58, 0.19, 0.025), glass)
      const back = front.clone()
      front.position.set(x, y, z + depth / 2 + 0.014)
      back.position.set(x, y, z - depth / 2 - 0.014)
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.19, depth * 0.58), glass)
      const otherSide = side.clone()
      side.position.set(x + width / 2 + 0.014, y, z)
      otherSide.position.set(x - width / 2 - 0.014, y, z)
      this.staticGroup.add(front, back, side, otherSide)
    }
  }

  private addModelRoads() {
    if (!this.roadStraightModel || !this.roadStraightHalfModel || !this.roadCrossroadModel) return
    const { map } = this.engine

    // A road-straight alaphelyzetben az X tengely mentén fut. A két egység
    // széles modulokat aránytartóan nagyítjuk, majd torzítás nélkül ismételjük.
    let top = 0
    for (const blockHeight of map.verticalLengths) {
      for (const crossingX of this.engine.xCrossings) {
        this.addStraightRoadRun(crossingX, top, blockHeight, true)
      }
      top += blockHeight + 2
    }

    let left = 0
    for (const blockWidth of map.horizontalLengths) {
      for (const crossingY of this.engine.yCrossings) {
        this.addStraightRoadRun(crossingY, left, blockWidth, false)
      }
      left += blockWidth + 2
    }

    // A path változat mind a négy bejáratán kész zebrát tartalmaz.
    for (const crossingX of this.engine.xCrossings) {
      for (const crossingY of this.engine.yCrossings) {
        const crossing = this.nativeModel(this.roadCrossroadModel, SOURCE_SCALE.roads)
        crossing.position.set(crossingX - map.width / 2, ROAD_Y, crossingY - map.height / 2)
        this.staticGroup.add(crossing)
      }
    }
  }

  private addStraightRoadRun(fixed: number, start: number, length: number, vertical: boolean) {
    if (!this.roadStraightModel || !this.roadStraightHalfModel) return
    const { map } = this.engine
    const tileSize = 2
    const tileCount = Math.floor(length / tileSize)

    for (let index = 0; index < tileCount; index++) {
      const tile = this.nativeModel(this.roadStraightModel, SOURCE_SCALE.roads)
      const along = start + tileSize * (index + 0.5)
      this.placeStraightRoadTile(tile, fixed, along, vertical, map.width, map.height)
    }

    if (length % tileSize) {
      // A half modell natív hossza fél csempe: egyenletes kétszeres
      // nagyítással pontosan kitölti az utolsó egy térképegységet.
      const half = this.nativeModel(this.roadStraightHalfModel, SOURCE_SCALE.roads)
      const along = start + tileCount * tileSize + 0.5
      this.placeStraightRoadTile(half, fixed, along, vertical, map.width, map.height)
    }
  }

  private placeStraightRoadTile(
    tile: THREE.Object3D,
    fixed: number,
    along: number,
    vertical: boolean,
    mapWidth: number,
    mapHeight: number,
  ) {
    if (vertical) {
      tile.position.set(fixed - mapWidth / 2, ROAD_Y, along - mapHeight / 2)
      tile.rotation.y = Math.PI / 2
    } else {
      tile.position.set(along - mapWidth / 2, ROAD_Y, fixed - mapHeight / 2)
    }
    this.staticGroup.add(tile)
  }

  private addRoadMarkings() {
    const { map } = this.engine
    const markingMaterial = new THREE.MeshBasicMaterial({ color: '#e8e7cf' })
    const dash = 0.42
    for (const y of this.engine.yCrossings) {
      for (let x = 0.25; x < map.width; x += 1.05) {
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(dash, 0.055), markingMaterial)
        mesh.rotation.x = -Math.PI / 2
        mesh.position.set(x - map.width / 2, ROAD_DETAIL_Y, y - map.height / 2)
        this.staticGroup.add(mesh)
      }
    }
    for (const x of this.engine.xCrossings) {
      for (let y = 0.25; y < map.height; y += 1.05) {
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.055, dash), markingMaterial)
        mesh.rotation.x = -Math.PI / 2
        mesh.position.set(x - map.width / 2, ROAD_DETAIL_Y, y - map.height / 2)
        this.staticGroup.add(mesh)
      }
    }
  }

  private addTrafficLights() {
    const { map } = this.engine
    const poleMaterial = new THREE.MeshStandardMaterial({ color: '#20241f', roughness: 0.7, flatShading: true })
    const poleGeometry = new THREE.CylinderGeometry(0.035, 0.045, 0.72, 5)
    const lampGeometry = new THREE.CircleGeometry(0.055, 10)
    const housingGeometry = new THREE.BoxGeometry(0.23, 0.48, 0.19)
    const housingMaterial = new THREE.MeshStandardMaterial({ color: '#181b18', roughness: 0.82, flatShading: true })
    // Oldalirányban a járdaszigeten maradnak, hosszirányban viszont a zebra
    // mögé, az érkező útszakasz felé húzzuk vissza őket.
    const offsets = [[0.82, 1.18], [-1.18, 0.82], [-0.82, -1.18], [1.18, -0.82]]
    // A Kenney modell vizuális tájolásához az érkező sáv irányán felül
    // még egy negyed fordulat szükséges.
    const rotations = [Math.PI / 2, 0, -Math.PI / 2, Math.PI]
    for (const node of this.engine.intersections) {
      if (node.type !== 'normal') continue
      offsets.forEach(([ox, oz], direction) => {
        const x = node.where.x + ox - map.width / 2
        const z = node.where.y + oz - map.height / 2
        if (this.trafficLightModel) {
          const signal = this.nativeModel(this.trafficLightModel, SOURCE_SCALE.roads)
          signal.position.set(x, this.roadCrossroadModel ? MODEL_ROAD_TOP_Y : ROAD_Y, z)
          signal.rotation.y = rotations[direction]
          const red = new THREE.Mesh(this.signalBulb, this.redSignal)
          const amber = new THREE.Mesh(this.signalBulb, this.amberSignal)
          const green = new THREE.Mesh(this.signalBulb, this.offGreenSignal)
          const lampFace = new THREE.Group()
          // A lámpatest negyed fordulatát visszakompenzáljuk csak a fényeken.
          lampFace.rotation.y = -Math.PI / 2
          // A GLB lámpafejének három lencséje; kis előretolás kerüli a z-fightingot.
          red.position.set(0, 0.952, 0.092)
          amber.position.set(0, 0.878, 0.092)
          green.position.set(0, 0.803, 0.092)
          lampFace.add(red, amber, green)
          signal.add(lampFace)
          this.staticGroup.add(signal)
          this.signals.push({ red, green, node, direction })
          return
        }
        const signal = new THREE.Group()
        signal.position.set(x, this.roadCrossroadModel ? MODEL_ROAD_TOP_Y : ROAD_Y, z)
        signal.rotation.y = rotations[direction]
        const pole = new THREE.Mesh(poleGeometry, poleMaterial)
        pole.position.set(0, 0.58, 0)
        pole.castShadow = true
        const housing = new THREE.Mesh(housingGeometry, housingMaterial)
        housing.position.set(0, 1.17, 0)
        housing.castShadow = true
        const red = new THREE.Mesh(lampGeometry, this.redSignal)
        const amber = new THREE.Mesh(lampGeometry, this.amberSignal)
        const green = new THREE.Mesh(lampGeometry, this.offGreenSignal)
        const lampFace = new THREE.Group()
        lampFace.rotation.y = -Math.PI / 2
        red.position.set(0.025, 1.32, 0.101)
        amber.position.set(0.025, 1.17, 0.101)
        green.position.set(0.025, 1.02, 0.101)
        lampFace.add(red, amber, green)
        signal.add(pole, housing, lampFace)
        this.staticGroup.add(signal)
        this.signals.push({ red, green, node, direction })
      })
    }
  }

  private updateSignals() {
    for (const signal of this.signals) {
      const isGreen = signal.node.green === signal.direction
      signal.red.material = isGreen ? this.offRedSignal : this.redSignal
      signal.green.material = isGreen ? this.greenSignal : this.offGreenSignal
    }
  }

  private updateCars(progress = this.progress) {
    for (const child of this.carGroup.children) child.visible = false
    for (const car of this.engine.cars) {
      const pose = carPoseAt(car, progress, LANE_INSET)
      if (!pose) continue
      let model = this.carInstances.get(car)
      if (!model) {
        model = this.makeCar(car)
        // A GLB és a tartalék modellek minden része, az árnyékuk is az úttest szélén végződik.
        model.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach((material) => {
            material.clippingPlanes = this.carClippingPlanes
            material.clipShadows = true
            material.needsUpdate = true
          })
        })
        this.carInstances.set(car, model)
        this.carGroup.add(model)
      }
      model.visible = true
      const roadSurfaceY = this.roadStraightModel ? MODEL_ROAD_TOP_Y : ROAD_DETAIL_Y
      const x = pose.x - 0.5
      const z = pose.y - 0.5
      model.position.set(x - this.engine.map.width / 2, roadSurfaceY, z - this.engine.map.height / 2)
      model.rotation.y = pose.rotation
    }
  }

  private makeCar(car: Car) {
    if (this.carModels.length) {
      return this.nativeModel(this.carModels[car.color % this.carModels.length], SOURCE_SCALE.cars)
    }
    const group = new THREE.Group()
    const material = this.carMaterials[car.color] ?? this.carMaterials[2]
    const body = new THREE.Mesh(this.carBody, material)
    body.position.y = 0.18
    body.castShadow = true
    const cabin = new THREE.Mesh(this.carCabin, this.cabinMaterial)
    cabin.position.set(0, 0.3, -0.04)
    cabin.castShadow = true
    group.add(body, cabin)
    ;[-1, 1].forEach((side) => {
      ;[-1, 1].forEach((end) => {
        const wheel = new THREE.Mesh(this.wheel, this.wheelMaterial)
        wheel.position.set(side * 0.25, 0.11, end * 0.24)
        wheel.rotation.z = Math.PI / 2
        group.add(wheel)
      })
    })
    if (car.indicator) {
      const indicator = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.08), new THREE.MeshBasicMaterial({ color: PALETTE[13] }))
      indicator.position.set(car.indicator === 1 ? 0.2 : -0.2, 0.23, 0.34)
      group.add(indicator)
    }
    return group
  }

  private resize = () => {
    const parent = this.canvas.parentElement
    const width = Math.max(1, parent?.clientWidth ?? 800)
    const height = Math.max(1, parent?.clientHeight ?? 600)
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.draw()
  }

  private draw = () => {
    this.renderer.render(this.scene, this.camera)
  }

  private animateScenery = (now: number) => {
    if (this.disposed) return
    this.seagulls.update((now - this.animationStartedAt) / 1000)
    this.draw()
  }

  private clearGroup(group: THREE.Group, dispose: boolean) {
    while (group.children.length) {
      const child = group.children.pop()!
      if (dispose && !child.userData.sharedAsset) {
        child.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return
          object.geometry.dispose()
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach((material) => material.dispose())
        })
      }
    }
  }

  dispose() {
    this.disposed = true
    this.resizeObserver.disconnect()
    this.renderer.setAnimationLoop(null)
    this.seagulls.dispose()
    this.engravingTextures.forEach((texture) => texture.dispose())
    this.controls.removeEventListener('change', this.draw)
    this.controls.dispose()
    this.clearGroup(this.staticGroup, true)
    this.clearGroup(this.carGroup, false)
    this.carBody.dispose()
    this.carCabin.dispose()
    this.wheel.dispose()
    this.signalBulb.dispose()
    this.redSignal.dispose()
    this.greenSignal.dispose()
    this.offRedSignal.dispose()
    this.offGreenSignal.dispose()
    this.amberSignal.dispose()
    this.cabinMaterial.dispose()
    this.wheelMaterial.dispose()
    this.carMaterials.forEach((material) => material.dispose())
    for (const template of [
      ...this.buildingModels,
      ...this.carModels,
      ...this.treeModels,
      ...this.parkProps.map(({ template }) => template),
      this.roadStraightModel,
      this.roadStraightHalfModel,
      this.roadCrossroadModel,
      this.trafficLightModel,
    ]) {
      if (template) disposeObject(template)
    }
    this.renderer.dispose()
    // A dispose az erőforrásokat üríti, de magát a böngésző GPU-kontextusát
    // nem. Nézetváltáskor ezt is elengedjük, különben elfogyhat a context limit.
    this.renderer.forceContextLoss()
  }
}

function makeCabinGeometry() {
  const vertices = new Float32Array([
    -0.2, 0, -0.18, 0.2, 0, -0.18, 0.2, 0, 0.18, -0.2, 0, 0.18,
    -0.14, 0.2, -0.12, 0.14, 0.2, -0.12, 0.14, 0.2, 0.12, -0.14, 0.2, 0.12,
  ])
  const indices = [4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7]
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function disposeObject(root: THREE.Object3D) {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    object.geometry.dispose()
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    materials.forEach((material) => {
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose()
      material.dispose()
    })
  })
}
