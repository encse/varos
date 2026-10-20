import * as THREE from 'three'

/** A forgalomtól független, a dioráma fölött köröző két sirály. */
export class Seagulls {
  readonly group = new THREE.Group()
  private readonly clippingPlanes = [
    new THREE.Plane(new THREE.Vector3(1, 0, 0)),
    new THREE.Plane(new THREE.Vector3(-1, 0, 0)),
    new THREE.Plane(new THREE.Vector3(0, 0, 1)),
    new THREE.Plane(new THREE.Vector3(0, 0, -1)),
  ]
  private readonly white = this.material('#eeeeda')
  private readonly grey = this.material('#b9c1c2')
  private readonly black = this.material('#303735')
  private readonly yellow = this.material('#dda844')
  private readonly geometries: THREE.BufferGeometry[] = []
  private readonly birds = [this.makeBird(), this.makeBird()]
  private width = 1
  private depth = 1
  private altitude = 6

  constructor() {
    this.group.add(...this.birds.map(({ body }) => body))
  }

  private material(color: string) {
    return new THREE.MeshStandardMaterial({
      color, roughness: 0.9, flatShading: true, side: THREE.DoubleSide,
      clippingPlanes: this.clippingPlanes, clipShadows: true,
    })
  }

  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[]) {
    this.geometries.push(geometry)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = true
    return mesh
  }

  private makeBird() {
    const body = new THREE.Group()
    const torso = this.mesh(new THREE.SphereGeometry(1, 8, 6), this.white)
    torso.scale.set(0.11, 0.1, 0.27)
    body.add(torso)
    const head = this.mesh(new THREE.SphereGeometry(0.09, 8, 6), this.white)
    head.position.set(0, 0.045, 0.24)
    body.add(head)
    const beak = this.mesh(new THREE.ConeGeometry(0.035, 0.16, 4), this.yellow)
    beak.rotation.x = Math.PI / 2
    beak.position.set(0, 0.035, 0.36)
    body.add(beak)
    const tail = this.mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0, -0.17, -0.12, 0.015, -0.4, 0.12, 0.015, -0.4,
    ], 3)), this.white)
    tail.geometry.computeVertexNormals()
    body.add(tail)

    const wings = [-1, 1].map((side) => {
      const pivot = new THREE.Group()
      pivot.position.x = side * 0.075
      const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([
        0, 0, 0.12, 0.36, 0.025, 0.02, 0, 0, -0.16,
        0.36, 0.025, 0.02, 0.52, 0, -0.17, 0, 0, -0.16,
        0.36, 0.025, 0.02, 0.72, -0.025, -0.25, 0.52, 0, -0.17,
      ], 3))
      geometry.addGroup(0, 6, 0)
      geometry.addGroup(6, 3, 1)
      geometry.computeVertexNormals()
      const wing = this.mesh(geometry, [this.grey, this.black])
      wing.scale.x = side
      pivot.add(wing)
      body.add(pivot)
      return pivot
    })
    return { body, wings }
  }

  setBounds(width: number, depth: number, roofHeight: number) {
    this.width = width
    this.depth = depth
    this.altitude = Math.max(5, roofHeight + 2)
    // Az autók a térképszél cellaközepén lépnek ki: fél cellával az úttest után.
    this.clippingPlanes[0].constant = this.clippingPlanes[1].constant = width / 2 + 0.5
    this.clippingPlanes[2].constant = this.clippingPlanes[3].constant = depth / 2 + 0.5
  }

  update(seconds: number) {
    this.birds.forEach(({ body, wings }, index) => {
      const angularSpeed = index === 0 ? 0.085 : -0.07
      const angle = seconds * angularSpeed + index * 2.4
      // A teljes szárnyfesztáv fordulás közben is maradjon a diorámán belül.
      const radiusX = Math.max(0, this.width / 2 - 1) * (index === 0 ? 0.92 : 0.72)
      const radiusZ = Math.max(0, this.depth / 2 - 1) * (index === 0 ? 0.72 : 0.92)
      body.position.set(
        Math.cos(angle) * radiusX,
        this.altitude + index * 0.8 + Math.sin(angle * 2) * 0.25,
        Math.sin(angle) * radiusZ,
      )
      body.rotation.set(0, Math.atan2(-Math.sin(angle) * radiusX * angularSpeed,
        Math.cos(angle) * radiusZ * angularSpeed), index === 0 ? 0.15 : -0.15, 'YXZ')
      // Hosszabb siklásokat rövid, lágyan induló szárnycsapássorozat szakít meg.
      const envelope = Math.max(0, Math.sin(seconds * 0.65 + index * 1.7)) ** 4
      const flap = 0.08 + Math.sin(seconds * 6.5 + index * 2) * envelope * 0.38
      wings[0].rotation.z = -flap
      wings[1].rotation.z = flap
    })
  }

  dispose() {
    this.geometries.forEach((geometry) => geometry.dispose())
    ;[this.white, this.grey, this.black, this.yellow].forEach((material) => material.dispose())
    this.group.clear()
  }
}
