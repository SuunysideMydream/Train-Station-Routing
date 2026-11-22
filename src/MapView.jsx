import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon.jsx'
import { lines, lineById, stations, stationById, transfers, transferStationIds, stopByKey, stopKey } from './network.js'
import basemap from './basemap.json'

const project = ([lon, lat]) => [(lon - 100.33) * 2050, (13.97 - lat) * 2110]
const points = Object.fromEntries(stations.map(station => [station.id, project([station.lon, station.lat])]))
const pointText = ([x, y]) => x.toFixed(1) + ',' + y.toFixed(1)
const makePath = (path, close = false) => 'M' + path.map(pointText).join('L') + (close ? 'Z' : '')
const geographicPath = (path, close) => makePath(path.map(project), close)
const transitPath = (ids) => makePath(ids.map(id => points[id]))
const linePaths = lines.map(line => [line, line.sequences.map(transitPath).join(' ')])
const walkingLinks = transfers.filter(({ from, to }) => from.id !== to.id)
const scene = {
  districts: basemap.districts.map(ring => geographicPath(ring, true)).join(' '),
  streets: basemap.roads.map(road => geographicPath(road)).join(' '),
  water: basemap.water.map(polygon => polygon.map(ring => geographicPath(ring, true)).join(' ')).join(' '),
  waterways: basemap.waterways.map(river => geographicPath(river)).join(' '),
  parks: basemap.parks.map(polygon => polygon.map(ring => geographicPath(ring, true)).join(' ')).join(' '),
}
const landmarks = [
  ['นนทบุรี', 100.457, 13.879],
  ['ปทุมธานี', 100.643, 13.95],
  ['กรุงเทพฯ', 100.494, 13.730],
  ['บางกะปิ', 100.702, 13.779],
  ['สมุทรปราการ', 100.626, 13.569],
]
const labeledStations = [
  'siam', 'mo-chit', 'lat-phrao', 'tao-poon', 'suvarnabhumi', 'samrong', 'makkasan',
  'khlong-bang-phai', 'lak-song', 'min-buri', 'khu-khot', 'kheha',
  'bang-wa', 'hua-mak', 'phaya-thai', 'nonthaburi-civic-center', 'wat-phra-sri-mahathat',
]

const bounds = (ids) => {
  const x = ids.map(id => points[id][0])
  const y = ids.map(id => points[id][1])
  return [Math.min(...x), Math.min(...y), Math.max(...x), Math.max(...y)]
}
const networkBounds = bounds(stations.map(station => station.id))
function fit([x0, y0, x1, y1], size, detail) {
  const padX = Math.min(size.width * 0.16, detail ? 108 : 114)
  const padY = Math.min(size.height * 0.19, detail ? 104 : 112)
  const scale = Math.min(
    (size.width - 2 * padX) / Math.max(x1 - x0, 50),
    (size.height - 2 * padY) / Math.max(y1 - y0, 50),
    detail ? 3.9 : 2,
  )
  return { scale, x: (size.width - (x0 + x1) * scale) / 2, y: (size.height - (y0 + y1) * scale) / 2 }
}
const screenPoint = ([x, y], camera) => [camera.x + x * camera.scale, camera.y + y * camera.scale]
const connectionPath = ({ from, to }) => transitPath([from.id, to.id])
const initial = { scale: 1, x: 0, y: 0 }

function layoutLabels(candidates, camera, size, markerSize) {
  const occupied = []
  const labels = []
  for (const id of candidates) {
    const station = stationById[id]
    const [x, y] = screenPoint(points[id], camera)
    const text = station.name
    const width = text.length * 6.2 + 5
    const anchors = [
      [10, -8, 'start'], [-10, -8, 'end'], [10, 14, 'start'], [-10, 14, 'end'],
      [0, 20, 'middle'], [0, -12, 'middle'],
    ]
    for (const [dx, dy, anchor] of anchors) {
      const left = x + dx - (anchor === 'end' ? width : anchor === 'middle' ? width / 2 : 0)
      const rect = [left - 4, y + dy - 13, left + width + 4, y + dy + 4]
      if (rect[0] < 10 || rect[1] < 11 || rect[2] > size.width - 10 || rect[3] > size.height - 22) continue
      if (occupied.some(([x0, y0, x1, y1]) => x0 < rect[2] && x1 > rect[0] && y0 < rect[3] && y1 > rect[1])) continue
      labels.push({ id, text, dx: (dx + Math.sign(dx) * markerSize) / camera.scale, dy: dy / camera.scale, anchor })
      occupied.push(rect)
      break
    }
  }
  return labels
}

export default function MapView({ route, activeLine, selected, onSelect }) {
  const container = useRef(null)
  const svg = useRef(null)
  const liveCamera = useRef(initial)
  const gesture = useRef({ points: new Map(), moved: false, suppress: 0 })
  const [size, setSize] = useState({ width: 860, height: 680 })
  const [camera, setCamera] = useState(initial)
  const [animating, setAnimating] = useState(false)
  const [hoverStation, setHoverStation] = useState(null)
  const [touchDrag, setTouchDrag] = useState(false)

  const highlighted = route ? new Set(route.legs.flatMap(leg => leg.stations || [leg.from.id, leg.to.id])) : null
  if (route) {
    highlighted.add(route.from.id)
    highlighted.add(route.to.id)
  }
  const overview = () => fit(route ? bounds([...highlighted]) : networkBounds, size, Boolean(route))

  function move(next, smooth = false) {
    liveCamera.current = next
    setAnimating(smooth)
    setCamera(next)
  }

  function zoom(factor, x, y, smooth = true) {
    const current = liveCamera.current
    const scale = Math.min(10, Math.max(0.34, current.scale * factor))
    const ratio = scale / current.scale
    move({ scale, x: x - (x - current.x) * ratio, y: y - (y - current.y) * ratio }, smooth)
  }

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width && height) setSize({ width, height })
    })
    observer.observe(container.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    move(overview(), true)
    setHoverStation(null)
  }, [size, route])

  useEffect(() => {
    const node = svg.current
    function wheel(event) {
      event.preventDefault()
      const rect = node.getBoundingClientRect()
      const amount = Math.max(-180, Math.min(180, event.deltaY))
      zoom(Math.exp(-amount / 520), event.clientX - rect.left, event.clientY - rect.top, false)
      setHoverStation(null)
    }
    node.addEventListener('wheel', wheel, { passive: false })
    return () => node.removeEventListener('wheel', wheel)
  }, [])

  function position(event) {
    const rect = svg.current.getBoundingClientRect()
    return [event.clientX - rect.left, event.clientY - rect.top]
  }

  function startGesture(event) {
    if (event.button !== 0 || (event.pointerType === 'touch' && !touchDrag)) return
    const state = gesture.current
    const location = position(event)
    if (!state.points.size) {
      state.origin = location
      state.moved = false
    }
    state.points.set(event.pointerId, location)
    if (state.points.size > 1) {
      state.moved = true
      for (const id of state.points.keys()) svg.current.setPointerCapture(id)
    }
  }

  function drag(event) {
    const state = gesture.current
    const previous = state.points.get(event.pointerId)
    if (!previous) return
    const next = position(event)
    const other = [...state.points].find(([id]) => id !== event.pointerId)?.[1]
    state.points.set(event.pointerId, next)
    if (other) {
      const previousDistance = Math.hypot(previous[0] - other[0], previous[1] - other[1])
      const distance = Math.hypot(next[0] - other[0], next[1] - other[1])
      if (previousDistance > 0) zoom(distance / previousDistance, other[0], other[1], false)
      return
    }
    const delta = [next[0] - state.origin[0], next[1] - state.origin[1]]
    if (!state.moved && Math.hypot(...delta) < 5) return
    const [dx, dy] = state.moved ? [next[0] - previous[0], next[1] - previous[1]] : delta
    if (!state.moved) svg.current.setPointerCapture(event.pointerId)
    state.moved = true
    const current = liveCamera.current
    move({ ...current, x: current.x + dx, y: current.y + dy })
    setHoverStation(null)
  }

  function endGesture(event) {
    const state = gesture.current
    state.points.delete(event.pointerId)
    if (state.moved) state.suppress = performance.now() + 220
  }

  const choose = (event, id) => {
    if (performance.now() < gesture.current.suppress && event.type === 'click') return
    event.stopPropagation()
    setHoverStation(null)
    onSelect(id)
  }
  const transform = 'translate(' + camera.x + 'px, ' + camera.y + 'px) scale(' + camera.scale + ')'
  const unit = 1 / camera.scale
  const effective = activeLine && !route
  const names = highlighted
    ? [...new Set([route.from.id, route.to.id, ...[...highlighted].filter(id => transferStationIds.has(id)), ...highlighted])]
    : [...new Set([...(selected ? [selected] : []), ...labeledStations.filter(id => stationById[id]), ...(camera.scale > 2.1 ? stations.map(s => s.id) : [])])]
  const labels = layoutLabels(names.filter(id => !effective || stationById[id].lineIds.includes(activeLine)), camera, size, 0)
  const tooltip = hoverStation && stationById[hoverStation]
  const tip = tooltip && screenPoint(points[tooltip.id], camera)
  const km = camera.scale > 2.6 ? 1 : 5
  const scaleLength = camera.scale * km * 19

  return (
    <div className="map-canvas" ref={container}>
      <svg ref={svg} className={touchDrag ? 'map-graphic touch-drag' : 'map-graphic'} viewBox={`0 0 ${size.width} ${size.height}`}
        onPointerDown={startGesture} onPointerMove={drag} onPointerUp={endGesture}
        onPointerCancel={endGesture} onPointerLeave={event => {
          if (!svg.current.hasPointerCapture(event.pointerId)) endGesture(event)
        }}
        onClick={event => choose(event, null)}
        role="group" aria-label="แผนที่รถไฟฟ้ากรุงเทพฯ">
        <g className={animating ? 'map-camera animated' : 'map-camera'} style={{ transform }}>
          <path className="district-path" d={scene.districts} />
          {scene.streets && <path className="street-path" d={scene.streets} />}
          {scene.parks && <path className="park-path" d={scene.parks} />}
          {scene.water && <path className="water-fill" d={scene.water} fillRule="evenodd" />}
          {scene.waterways && <path className="waterway-path" d={scene.waterways} />}
          {landmarks.map(([name, lon, lat]) => (
            <text className="map-landmark" key={name} x={project([lon, lat])[0]} y={project([lon, lat])[1]}
              fontSize={11 * unit} textAnchor="middle">{name}</text>
          ))}
          {linePaths.map(([line, path]) => {
            const dim = Boolean(route) || (activeLine && activeLine !== line.id)
            return <g key={line.id} className={dim ? 'rail-segment dim' : 'rail-segment'}>
              <path className="rail-halo" d={path} />
              <path className="rail-path" d={path} stroke={line.color} />
            </g>
          })}
          {walkingLinks.map(link => (
            <path key={link.from.key + link.to.key} className="transfer-path" d={connectionPath(link)}
              opacity={route || (activeLine && ![link.from.lineId, link.to.lineId].includes(activeLine)) ? 0.23 : 1} />
          ))}
          {route?.legs.map((leg, index) => {
            if (leg.type === 'ride') return <g key={index} className="route-ink">
              <path className="route-halo" d={transitPath(leg.stations)} />
              <path className="route-path" d={transitPath(leg.stations)} stroke={lineById[leg.lineId].color} />
            </g>
            if (leg.from.id !== leg.to.id) return <path key={index} className="route-transfer" d={connectionPath(leg)} />
            return null
          })}
          {stations.map(station => {
            const [x, y] = points[station.id]
            const connected = transferStationIds.has(station.id)
            const isEndpoint = route?.from.id === station.id || route?.to.id === station.id
            const focused = selected === station.id || isEndpoint
            const dim = !focused && (highlighted ? !highlighted.has(station.id) : effective && !station.lineIds.includes(activeLine))
            const radius = (connected ? 4.7 : 3.45) * unit
            const color = lineById[station.lineIds[0]].color
            const codes = station.lineIds.map(id => stopByKey[stopKey(station.id, id)].code).join(' / ')
            return (
              <g key={station.id} transform={`translate(${x} ${y})`} className={dim ? 'map-station faded' : 'map-station'}
                role="button" tabIndex={names.includes(station.id) && !dim ? 0 : -1}
                aria-label={station.name + ' ' + codes}
                onClick={event => choose(event, station.id)}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    choose(event, station.id)
                  }
                }}
                onPointerEnter={event => {
                  if (event.pointerType === 'mouse' && !gesture.current.points.size) setHoverStation(station.id)
                }}
                onPointerLeave={() => setHoverStation(null)}>
                <circle r={Math.max(radius + 2 * unit, 8 * unit)} fill="transparent" />
                {focused && <circle className="active-station-ring" r={(isEndpoint ? 10.5 : 9) * unit} />}
                <circle className="station-dot" r={focused ? radius + unit : radius} stroke={connected || focused ? '#1e3338' : color} />
                {connected && <circle r={1.6 * unit} fill="#253b3c" pointerEvents="none" />}
              </g>
            )
          })}
          {labels.map(({ id, text, dx, dy, anchor }) => (
            <text key={id} className="station-label" x={points[id][0] + dx} y={points[id][1] + dy}
              fontSize={(route ? 13 : 12) * unit} textAnchor={anchor}>{text}</text>
          ))}
        </g>
      </svg>
      {tooltip && tip[0] > 0 && tip[0] < size.width && tip[1] > 0 && tip[1] < size.height &&
        <div className="map-tooltip" style={{ left: Math.min(size.width - 82, Math.max(82, tip[0])), top: Math.max(68, tip[1] - 12) }}>
          <strong>{tooltip.name}</strong>
          <span>{tooltip.lineIds.map(id => stopByKey[stopKey(tooltip.id, id)].code).join(' / ')}</span>
        </div>}
      <div className="map-controls" aria-label="ควบคุมแผนที่">
        <button type="button" className="drag-toggle" aria-pressed={touchDrag}
          aria-label="ลากและบีบซูมแผนที่" title="ลากและบีบซูมแผนที่"
          onClick={() => setTouchDrag(value => !value)}><Icon name="move" /></button>
        <div className="map-control-group">
          <button type="button" title="ขยาย" aria-label="ขยายแผนที่" onClick={() => zoom(1.38, size.width / 2, size.height / 2)}><Icon name="plus" /></button>
          <button type="button" title="ย่อ" aria-label="ย่อแผนที่" onClick={() => zoom(1 / 1.38, size.width / 2, size.height / 2)}><Icon name="minus" /></button>
        </div>
        <button type="button" title={route ? 'จัดแผนที่ให้พอดีเส้นทาง' : 'ดูทั้งเครือข่าย'} aria-label="จัดมุมมองแผนที่" onClick={() => move(overview(), true)}><Icon name="fit" /></button>
      </div>
      <div className="map-scale" aria-hidden="true">
        <Icon name="compass" size={16} />
        <div style={{ width: scaleLength }}><span>{km} กม.</span></div>
      </div>
    </div>
  )
}
