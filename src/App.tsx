import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { CityEngine } from './simulation/engine'
import { generateRandomCity } from './simulation/generator'
import { renderCity } from './simulation/renderer'
import { City3DRenderer } from './simulation/renderer3d'
import type { CarProgram, CityMap } from './simulation/types'

type BrowserWebGLContext = WebGLRenderingContext | WebGL2RenderingContext

function makeEngine(map: CityMap, program: CarProgram) {
  return new CityEngine(map, program)
}

/**
 * A Chrome alapértelmezett kontextusával indulunk. Egyes driverek elutasítják
 * a Three.js összes explicit attribútumát, miközben az alap WebGL működik.
 */
function createBrowserWebGLContext(canvas: HTMLCanvasElement): BrowserWebGLContext | null {
  return canvas.getContext('webgl2')
    ?? canvas.getContext('webgl')
    ?? canvas.getContext('experimental-webgl') as BrowserWebGLContext | null
}

export default function App() {
  const [city, setCity] = useState(() => generateRandomCity(crypto.getRandomValues(new Uint32Array(1))[0]))
  const [engine, setEngine] = useState(() => makeEngine(city.map, city.program))
  const [stats, setStats] = useState(() => engine.stats())
  const [running, setRunning] = useState(false)
  const [rate, setRate] = useState(8)
  const [primaryView, setPrimaryView] = useState<'3d' | 'radar'>('3d')
  const [message, setMessage] = useState(`KEZDŐ VÁROS: ${city.map.columns} × ${city.map.rows} KERESZTEZŐDÉS, ${city.program.declaredCount} AUTÓ.`)
  const [error, setError] = useState('')
  const [dioramaStatus, setDioramaStatus] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const threeCanvasRef = useRef<HTMLCanvasElement>(null)
  const threeRendererRef = useRef<City3DRenderer | null>(null)
  const infoDialogRef = useRef<HTMLDialogElement>(null)
  const animationFrameRef = useRef<number | null>(null)
  const animationProgressRef = useRef(1)

  const paint = useCallback((target = engine, progress = 1, refreshStats = true) => {
    if (canvasRef.current) renderCity(canvasRef.current, target)
    threeRendererRef.current?.update(target, progress)
    if (refreshStats) setStats(target.stats())
  }, [engine])

  const finishAnimation = useCallback((target = engine) => {
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current)
    animationFrameRef.current = null
    animationProgressRef.current = 1
    paint(target, 1, false)
  }, [engine, paint])

  const animateStep = useCallback((target: CityEngine) => {
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current)
    const startedAt = performance.now()
    const duration = 1000 / rate
    animationProgressRef.current = 0
    paint(target, 0, false)
    const frame = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration)
      animationProgressRef.current = progress
      paint(target, progress, false)
      if (progress < 1) animationFrameRef.current = requestAnimationFrame(frame)
      else animationFrameRef.current = null
    }
    animationFrameRef.current = requestAnimationFrame(frame)
  }, [paint, rate])

  // A renderer a vászonhoz tartozik: restartkor az update kapja az új motort.
  // Az újralétrehozás ugyanazon a vásznon már elvesztett WebGL-kontextust kapna.
  useLayoutEffect(() => {
    if (!threeCanvasRef.current) return
    let renderer: City3DRenderer | null = null
    try {
      const canvas = threeCanvasRef.current
      const context = createBrowserWebGLContext(canvas)
      if (!context) throw new Error('A Chrome ezen a vásznon nem hozott létre WebGL 2 vagy WebGL 1 kontextust.')
      renderer = new City3DRenderer(canvas, engine, context)
      threeRendererRef.current = renderer
    } catch (problem) {
      threeRendererRef.current = null
      const reason = problem instanceof Error ? problem.message : 'ismeretlen WebGL-hiba'
      setDioramaStatus(`WEBGL HIBA // ${reason}`)
    }
    return () => {
      renderer?.dispose()
      if (threeRendererRef.current === renderer) threeRendererRef.current = null
    }
  }, [])

  useEffect(() => { paint(engine, animationProgressRef.current) }, [engine, paint])

  useEffect(() => () => {
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current)
  }, [])

  const step = useCallback(() => {
    try {
      finishAnimation(engine)
      engine.step()
      setStats(engine.stats())
      animateStep(engine)
      setError('')
    } catch (problem) {
      setRunning(false)
      setError(problem instanceof Error ? problem.message : 'Ismeretlen szimulációs hiba.')
    }
  }, [animateStep, engine, finishAnimation])

  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(step, 1000 / rate)
    return () => window.clearInterval(timer)
  }, [rate, running, step])

  const restart = useCallback((nextCity = city, notice = 'A SZIMULÁCIÓ ÚJRAINDULT.') => {
    try {
      const next = makeEngine(nextCity.map, nextCity.program)
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
      animationProgressRef.current = 1
      setRunning(false)
      setCity(nextCity)
      setEngine(next)
      setStats(next.stats())
      setError('')
      setMessage(notice)
      requestAnimationFrame(() => {
        if (canvasRef.current) renderCity(canvasRef.current, next)
      })
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Az input nem olvasható.')
    }
  }, [city])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement) return
      if (event.target instanceof Element && event.target.closest('button') && (event.code === 'Space' || event.code === 'Enter')) return
      if (event.code === 'Space') {
        event.preventDefault()
        setRunning((value) => !value)
      } else if (event.code === 'ArrowRight' || event.code === 'Enter') {
        event.preventDefault()
        step()
      } else if (event.key.toLowerCase() === 'r') restart()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [restart, step])

  const applyGenerated = () => {
    const seed = crypto.getRandomValues(new Uint32Array(1))[0]
    const result = generateRandomCity(seed)
    restart(result, `ÚJ VÁROS: ${result.map.columns} × ${result.map.rows} KERESZTEZŐDÉS, ${result.program.declaredCount} AUTÓ.`)
  }

  const completion = useMemo(() => stats.total ? Math.round((stats.finished / stats.total) * 100) : 0, [stats])

  return (
    <main className="app-shell">
      <header className="masthead">
        <div className="brand-lockup">
          <span className="brand-kicker">BUDAPEST / 2000</span>
          <h1>VÁROS<span>.EXE</span></h1>
        </div>
        <div className="header-copy">
          <p>FORGALOMSZIMULÁTOR // JAVASCRIPT PORT</p>
          <p className="muted">C++ / GRX20 EREDETI LOGIKA</p>
        </div>
        <button className="generate-button" onClick={applyGenerated}>Város generálása</button>
      </header>

      <section className="workstation">
        <div className="screen-frame">
          <div className="screen-titlebar">
            <div className="memoriam-title">
              <span>In memoriam Sike Sándor</span>
              <button
                className="info-button"
                type="button"
                aria-label="A projektről"
                onClick={() => infoDialogRef.current?.showModal()}
              >i</button>
            </div>
          </div>
          <div className="screen-bezel">
            <div className="view-stage">
              <div className={`scene-pane three-view ${primaryView === '3d' ? 'is-primary' : 'is-preview'}`}>
                <canvas ref={threeCanvasRef} className="webgl-canvas" aria-label="Forgalmi szimuláció háromdimenziós low-poly városa" />
                <div className="scanlines" aria-hidden="true" />
                <div className="orbit-help">HÚZÁS: FORGATÁS · GÖRGŐ: ZOOM · JOBB GOMB: MOZGATÁS</div>
                {dioramaStatus && <div className={`diorama-status ${dioramaStatus.includes('HIBA') ? 'is-error' : ''}`}>{dioramaStatus}</div>}
                {primaryView !== '3d' && <button className="preview-promote" onClick={() => setPrimaryView('3d')} aria-label="3D nézet nagyítása">
                  <span>3D DIORÁMA <span>↗ NAGYÍTÁS</span></span>
                </button>}
              </div>
              <div className={`scene-pane radar-view ${primaryView === 'radar' ? 'is-primary' : 'is-preview'}`}>
                <div className="radar-surface">
                  <canvas ref={canvasRef} aria-label="Forgalmi szimuláció kétdimenziós térképe" />
                </div>
                <div className="scanlines" aria-hidden="true" />
                {primaryView !== 'radar' && <button className="preview-promote" onClick={() => setPrimaryView('radar')} aria-label="Radar nagyítása">
                  <span>2D FORGALMI RADAR <span>↗ NAGYÍTÁS</span></span>
                </button>}
              </div>
            </div>
            <div className="bottom-dock">
              <div className={`terminal-line ${error ? 'terminal-error' : ''}`} role="status">
                <span className="prompt">C:\VAROS&gt;</span> {error || message}<span className="cursor">█</span>
              </div>
            <section className="control-deck">
              <div className="transport">
                <button className={`run-button ${running ? 'running' : ''}`} onClick={() => setRunning((value) => !value)}>
                  <span className="run-icon">{running ? 'Ⅱ' : '▶'}</span>
                  <span><small>{running ? 'FUTÁS' : 'SZÜNET'}</small>{running ? 'MEGÁLLÍTÁS' : 'INDÍTÁS'}</span>
                </button>
                <button className="step-button" onClick={step}>
                  <svg className="step-icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
                    <rect x="3" y="4" width="3" height="16" />
                    <path d="M10 4L22 12L10 20Z" />
                  </svg>
                  <small>KÖVETKEZŐ KÖR</small>
                </button>
                <button className="reset-button" onClick={() => restart()}><span>↺</span><small>RESET</small></button>
              </div>
              <div className="speed-control">
                <div><span>SEBESSÉG</span><output>{rate} KÖR/S</output></div>
                <input type="range" min="1" max="30" value={rate} onChange={(event) => setRate(Number(event.target.value))} />
              </div>
              <div className="stats-strip">
                <Stat label="KÖR" value={stats.tick} color="cyan" />
                <Stat label="MOZGÁSBAN" value={stats.active} color="green" />
                <Stat label="VÁRAKOZIK" value={stats.waiting} color="yellow" />
                <Stat label="CÉLBA ÉRT" value={stats.finished} color="magenta" />
              </div>
              <div className="progress-block">
                <div><span>FELDOLGOZÁS</span><strong>{completion}%</strong></div>
                <div className="progress-track"><i style={{ width: `${completion}%` }} /></div>
                <small>{stats.read} / {stats.total} AUTÓ BEOLVASVA</small>
              </div>
            </section>
            </div>
          </div>
        </div>

      </section>

      <dialog
        ref={infoDialogRef}
        className="info-dialog"
        aria-labelledby="info-dialog-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close()
        }}
      >
        <div className="info-dialog-card">
          <header>
            <div>
              <span className="dialog-kicker">README.TXT</span>
              <h2 id="info-dialog-title">A VÁROS.EXE-RŐL</h2>
            </div>
            <button type="button" aria-label="Bezárás" onClick={() => infoDialogRef.current?.close()}>×</button>
          </header>
          <div className="info-dialog-copy">
            <p>A Varos.exe egy 2000-es évek környéki beadandó újragondolása TypeScriptben.</p>
            <p>Az eredeti változat C++-ban készült Sike Sándor tanár úr felügyelete alatt. Már nem emlékszem, hogy másod- vagy 
              harmadéves projekt volt-e ez.</p>
            <p>Az eredeti kód még megvan GitHubon, természetesen teljesen hulladéknak néz ki ennyi év távlatából. A 2D radaron 
              láthatjuk a működését. DOS alatt pontosan így nézett ki, de mindig akartam hozzá egy rendes 3D vizualizációt csinálni.
              Most már van AI, szóval egy nap alatt össze lehet kalapálni az egészet. A kódja emberi fogyasztásra valószínűleg 
              nem ajánlott...</p>
            <p>Sike tanár úr azóta is eszembe jut néha. Sajnos fiatalon elhunyt, de álljon itt neki ez a kis projekt örök emlékül.</p>
          </div>
        </div>
      </dialog>

      <footer><span>© 2000 → 2026</span><span>BUILD 2.0 / TS</span></footer>
    </main>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return <div className="stat"><i className={color} /><span>{label}</span><strong>{String(value).padStart(4, '0')}</strong></div>
}
