import * as THREE from 'three'

/** A makettháttérből a kamera közelítésével és leengedésével előtűnő égbolt. */
export class DioramaSky {
  private readonly material = new THREE.ShaderMaterial({
    uniforms: {
      skyAmount: { value: 0 },
      dark: { value: new THREE.Color('#171918') },
      zenith: { value: new THREE.Color('#287fc1') },
      horizon: { value: new THREE.Color('#6caadd') },
      below: { value: new THREE.Color('#629cc8') },
    },
    vertexShader: `
      varying vec3 skyDirection;
      void main() {
        skyDirection = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float skyAmount;
      uniform vec3 dark;
      uniform vec3 zenith;
      uniform vec3 horizon;
      uniform vec3 below;
      varying vec3 skyDirection;
      void main() {
        float elevation = normalize(skyDirection).y;
        vec3 sky = mix(horizon, zenith, smoothstep(0.0, 0.65, elevation));
        sky = mix(below, sky, smoothstep(-0.35, 0.0, elevation));
        gl_FragColor = vec4(mix(dark, sky, skyAmount), 1.0);
        #include <colorspace_fragment>
      }
    `,
    side: THREE.BackSide,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  })
  readonly mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), this.material)
  private readonly offset = new THREE.Vector3()
  private skyVisible = false
  private transitionStarted: number | null = null

  constructor() {
    this.mesh.renderOrder = -1000
    this.mesh.frustumCulled = false
  }

  update(camera: THREE.PerspectiveCamera, target: THREE.Vector3, citySize: number, now = performance.now()) {
    this.offset.subVectors(camera.position, target)
    const distance = this.offset.length()
    const elevation = Math.asin(THREE.MathUtils.clamp(this.offset.y / Math.max(distance, 0.001), -1, 1))
    const relativeDistance = distance / Math.max(citySize, 1)
    if (this.transitionStarted === null) {
      // Eltérő be- és kilépési küszöb: a határon mozgatva sem villog a háttér.
      const next = this.skyVisible
        ? relativeDistance < 1.02 && elevation < THREE.MathUtils.degToRad(42)
        : relativeDistance < 0.85 && elevation < THREE.MathUtils.degToRad(32)
      if (next !== this.skyVisible) {
        this.skyVisible = next
        this.transitionStarted = now
      }
    }
    if (this.transitionStarted !== null) {
      // A váltás kameraállástól függetlenül végigfut, nem maradhat kevert állapotban.
      const progress = THREE.MathUtils.clamp((now - this.transitionStarted) / 650, 0, 1)
      const eased = THREE.MathUtils.smoothstep(progress, 0, 1)
      this.material.uniforms.skyAmount.value = this.skyVisible ? eased : 1 - eased
      if (progress === 1) this.transitionStarted = null
    }
    // A gömb a kamerát követi: eltoláskor sem közeledik a horizont, és nem látszik a széle.
    this.mesh.position.copy(camera.position)
    this.mesh.scale.setScalar(camera.far * 0.8)
  }

  dispose() {
    this.mesh.geometry.dispose()
    this.material.dispose()
  }
}
