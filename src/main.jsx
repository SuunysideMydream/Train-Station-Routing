import { useId, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/manrope/wght.css'
import '@fontsource/ibm-plex-sans-thai/thai-400.css'
import '@fontsource/ibm-plex-sans-thai/thai-500.css'
import '@fontsource/ibm-plex-sans-thai/thai-600.css'
import '@fontsource/ibm-plex-sans-thai/thai-700.css'
import { Icon } from './Icon.jsx'
import MapView from './MapView.jsx'
import { example, lines, lineById, searchStops, stationById, stationConnections, stations, stopByKey, stopKey } from './network.js'
import { findRoute } from './router.js'
import stationDataUrl from './bangkok-open-data.json?url'
import mapDataUrl from './basemap.json?url'
import './styles.css'

const popularStops = [example.from, 'sukhumvit:siam', 'blue:lat-phrao', 'arl:suvarnabhumi', example.to]
const emptyField = { key: '', query: '' }
const fieldFor = (stop) => ({ key: stop.key, query: stop.name })

function LineLabel({ lineId, withCode }) {
  const line = lineById[lineId]
  return <span className="line-label">
    <span className="line-dot" style={{ '--line-color': line.color }} />
    {line.operator === 'ARL' ? line.name : line.operator + ' ' + line.name}
    {withCode && <span className="code">{withCode}</span>}
  </span>
}

function StationInput({ field, title, type, onChange }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(-1)
  const selected = stopByKey[field.key]
  const results = field.query ? searchStops(field.query).slice(0, 7) : popularStops.map(key => stopByKey[key])

  function select(stop) {
    onChange(fieldFor(stop))
    setOpen(false)
    setIndex(-1)
  }

  function handleKey(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      const step = event.key === 'ArrowDown' ? 1 : -1
      setIndex(Math.max(0, Math.min(results.length - 1, index + step)))
    } else if (event.key === 'Enter' && open && results.length && (index >= 0 || !selected)) {
      event.preventDefault()
      select(results[Math.max(index, 0)])
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
    }
  }

  return <div className="station-input">
    <label htmlFor={id}><span className={'field-pin ' + type} />{title}</label>
    <div className={'field-entry' + (selected ? ' has-code' : '')}>
      <input id={id} type="text" role="combobox" autoComplete="off" aria-autocomplete="list"
        aria-expanded={open} aria-controls={id + '-list'}
        aria-activedescendant={open && index >= 0 && results[index] ? id + '-option-' + index : undefined}
        value={field.query} onFocus={event => {
          setOpen(true)
          if (selected) event.currentTarget.select()
        }}
        onBlur={() => { setOpen(false); setIndex(-1) }}
        onChange={event => { onChange({ key: '', query: event.target.value }); setOpen(true); setIndex(-1) }}
        onKeyDown={handleKey} placeholder="ชื่อไทย อังกฤษ หรือรหัส" />
      {selected && <span className="code input-code" style={{ '--line-color': lineById[selected.lineId].color }}>{selected.code}</span>}
    </div>
    {open && <ul id={id + '-list'} role="listbox" className="station-results">
      {results.map((stop, i) => (
        <li key={stop.key} role="option" aria-selected={index === i || stop.key === field.key} id={id + '-option-' + i}
          className={index === i ? 'keyboard-active' : ''}
          onPointerDown={event => event.preventDefault()} onClick={() => select(stop)}>
          <span className="option-title"><strong>{stop.name}</strong><small>{stop.en}</small></span>
          <span className="option-line"><LineLabel lineId={stop.lineId} withCode={stop.code} /></span>
        </li>
      ))}
      {!results.length && <li className="no-match">ไม่พบสถานีในเครือข่ายนี้</li>}
    </ul>}
  </div>
}

function RouteStep({ leg }) {
  if (leg.type !== 'ride') {
    const within = leg.type === 'within'
    const reboard = leg.type === 'reboard'
    const title = reboard ? 'เปลี่ยนขบวนที่' : within ? 'เปลี่ยนสายที่' : 'เดินต่อสายที่'
    return <li className="route-interchange">
      <span className="step-symbol"><Icon name={reboard ? 'train' : 'walk'} size={17} /></span>
      <div>
        <strong>{title} {leg.from.name}</strong>
        {leg.from.id !== leg.to.id && <span className="walk-detail">ไป {leg.to.name} <span className="code">{leg.to.code}</span></span>}
        {leg.from.id === leg.to.id && !reboard && <span className="walk-detail"><LineLabel lineId={leg.to.lineId} withCode={leg.to.code} /></span>}
        {reboard && <span className="walk-detail">ดูป้ายชานชาลาและปลายทางขบวน</span>}
      </div>
    </li>
  }
  const line = lineById[leg.lineId]
  const start = stopByKey[stopKey(leg.stations[0], leg.lineId)]
  const end = stopByKey[stopKey(leg.stations.at(-1), leg.lineId)]
  const count = leg.stations.length - 1
  return <li className="route-train" style={{ '--line-color': line.color }}>
    <div className="route-train-heading">
      <LineLabel lineId={leg.lineId} />
      <span>{count} สถานี</span>
    </div>
    <p className="ride-heading">มุ่งหน้า {leg.heading.name}</p>
    <div className="ride-stop"><span className="route-node" /><span>ขึ้นที่ <strong>{start.name}</strong></span><span className="code">{start.code}</span></div>
    {count > 1 && <details className="via">
      <summary>ดูอีก {count - 1} สถานี<Icon name="chevron" size={13} /></summary>
      <ol>{leg.stations.slice(1, -1).map(id => {
        const stop = stopByKey[stopKey(id, leg.lineId)]
        return <li key={id}><span>{stop.name}</span><span className="code">{stop.code}</span></li>
      })}</ol>
    </details>}
    <div className="ride-stop"><span className="route-node filled" /><span>ลงที่ <strong>{end.name}</strong></span><span className="code">{end.code}</span></div>
  </li>
}

function Directions({ route, onClear }) {
  return <div className="directions" aria-live="polite">
    <div className="directions-header">
      <h2>เส้นทางแนะนำ</h2>
      <button type="button" className="text-button" onClick={onClear}>ซ่อนเส้นทาง</button>
    </div>
    <div className="route-summary">
      <div><strong>{route.stops}</strong><span>สถานีที่นั่งผ่าน</span></div>
      <div><strong>{route.changes}</strong><span>ครั้งที่ต่อขบวน</span></div>
    </div>
    <ol className="route-steps">{route.legs.map((leg, index) => <RouteStep key={index} leg={leg} />)}</ol>
  </div>
}

function StationCard({ id, onClose, onSet, activeLine }) {
  const station = stationById[id]
  const [lineId, setLineId] = useState(station.lineIds.includes(activeLine) ? activeLine : station.lineIds[0])
  const connections = stationConnections(id)
  return <div className="station-card">
    <div className="station-card-title">
      <div><h2>{station.name}</h2><p>{station.en}</p></div>
      <button type="button" className="icon-plain" aria-label="ปิดข้อมูลสถานี" onClick={onClose}><Icon name="close" /></button>
    </div>
    <div className="station-lines">
      {station.lineIds.map(line => {
        const stop = stopByKey[stopKey(id, line)]
        if (station.lineIds.length === 1) return <LineLabel key={line} lineId={line} withCode={stop.code} />
        return <button key={line} type="button" aria-pressed={lineId === line} onClick={() => setLineId(line)}>
          <LineLabel lineId={line} withCode={stop.code} />
        </button>
      })}
    </div>
    {connections.length > 0 && <div className="station-connections">
      <h3>จุดต่อสาย</h3>
      {connections.map(({ to, type }) => (
        <div key={to.key}><Icon name={type === 'within' ? 'train' : 'walk'} size={16} />
          {to.id !== id && <span>{to.name}</span>}
          <LineLabel lineId={to.lineId} withCode={to.code} />
        </div>
      ))}
    </div>}
    <div className="station-actions">
      <button type="button" onClick={() => onSet('from', stopByKey[stopKey(id, lineId)])}>ตั้งต้นทาง</button>
      <button type="button" onClick={() => onSet('to', stopByKey[stopKey(id, lineId)])}>ตั้งปลายทาง</button>
    </div>
  </div>
}

function DataDialog({ dialogRef }) {
  return <dialog ref={dialogRef} className="data-dialog" aria-labelledby="data-title" onClick={event => {
    if (event.target === dialogRef.current) dialogRef.current.close()
  }}>
    <div className="dialog-body">
      <div className="station-card-title">
        <h2 id="data-title">ข้อมูลแผนที่</h2>
        <button type="button" className="icon-plain" aria-label="ปิดข้อมูลแผนที่" onClick={() => dialogRef.current.close()}><Icon name="close" /></button>
      </div>
      <p>ชุดข้อมูลสถานี ณ 12 พ.ย. 2569 ครอบคลุม BTS สุขุมวิทและสีลม, MRT สีน้ำเงิน ม่วง ชมพูสายหลัก เหลือง และ Airport Rail Link</p>
      <p>แผนที่แสดงตำแหน่งสถานีและแนวเชื่อมโดยประมาณ ผลลัพธ์เรียงตามจำนวนสถานีหรือจำนวนครั้งที่ต่อขบวนตามที่เลือก</p>
      <p>พิกัดและลำดับสถานีจาก <a href="https://metroly.zzxxccvv.com/en/about/data" target="_blank" rel="noreferrer">Metroly</a> และ <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a> ภายใต้ <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer">ODbL 1.0</a></p>
      <div className="data-downloads">
        <a href={stationDataUrl} download="bangkok-stations-source.json">ข้อมูลสถานี JSON</a>
        <a href={mapDataUrl} download="bangkok-basemap.json">ข้อมูลพื้นแผนที่ JSON</a>
      </div>
    </div>
  </dialog>
}

function App() {
  const [fields, setFields] = useState({ from: emptyField, to: emptyField })
  const [mode, setMode] = useState('stops')
  const [route, setRoute] = useState(null)
  const [selected, setSelected] = useState(null)
  const [activeLine, setActiveLine] = useState(null)
  const [message, setMessage] = useState('')
  const dialog = useRef(null)

  function editField(type, field) {
    setFields(current => ({ ...current, [type]: field }))
    setRoute(null)
    setMessage('')
  }

  function calculate(from, to, routingMode = mode) {
    if (!from || !to) {
      setMessage('เลือกต้นทางและปลายทางจากรายการสถานีก่อน')
      return
    }
    if (from === to) {
      setMessage('ต้นทางและปลายทางเป็นสถานีเดียวกัน')
      return
    }
    const result = findRoute(from, to, routingMode)
    setRoute(result)
    setMessage(result ? '' : 'ยังไม่พบเส้นทางในเครือข่ายนี้')
    setActiveLine(null)
    setSelected(null)
  }

  function tryExample() {
    setFields({ from: fieldFor(stopByKey[example.from]), to: fieldFor(stopByKey[example.to]) })
    calculate(example.from, example.to)
  }

  function useStation(type, stop) {
    editField(type, fieldFor(stop))
    setSelected(null)
  }

  function swap() {
    setFields({ from: fields.to, to: fields.from })
    if (route) calculate(fields.to.key, fields.from.key)
    else setMessage('')
  }

  function selectMode(value) {
    setMode(value)
    if (route) calculate(fields.from.key, fields.to.key, value)
  }

  return <>
    <header className="topbar">
      <div className="brand">
        <img src={import.meta.env.BASE_URL + 'icon.svg'} width="42" height="42" alt="" />
        <div><strong>รางกรุง</strong><span>Bangkok Rail Map</span></div>
      </div>
      <div className="topbar-meta">
        <span className="coverage"><Icon name="train" size={17} /><strong>{lines.length}</strong> สาย <span className="divider-dot" /><strong>{stations.length}</strong> สถานี</span>
        <button type="button" className="data-link" aria-label="ข้อมูลแผนที่" onClick={() => dialog.current.showModal()}><Icon name="info" size={18} /><span>ข้อมูลแผนที่</span></button>
      </div>
    </header>
    <main className="desk">
      <section className="planner" aria-labelledby="planner-title">
        <div className="planner-heading">
          <div className="planner-icon"><Icon name="route" size={23} /></div>
          <div><h1 id="planner-title">วางแผนเส้นทาง</h1><p>เลือกสถานีต้นทางและปลายทาง</p></div>
        </div>
        <form onSubmit={event => { event.preventDefault(); calculate(fields.from.key, fields.to.key) }}>
          <div className="station-fields">
            <StationInput type="origin" title="ต้นทาง" field={fields.from} onChange={field => editField('from', field)} />
            <StationInput type="destination" title="ปลายทาง" field={fields.to} onChange={field => editField('to', field)} />
            <button type="button" className="swap-button" aria-label="สลับต้นทางและปลายทาง" title="สลับต้นทางและปลายทาง" onClick={swap}><Icon name="swap" size={19} /></button>
          </div>
          <div className="route-modes" role="group" aria-label="เกณฑ์แนะนำเส้นทาง">
            <button type="button" aria-pressed={mode === 'stops'} onClick={() => selectMode('stops')}>จอดน้อย</button>
            <button type="button" aria-pressed={mode === 'changes'} onClick={() => selectMode('changes')}>ต่อขบวนน้อย</button>
          </div>
          <button type="submit" className="route-button"><Icon name="route" size={20} />ค้นหาเส้นทาง</button>
          {message && <p role="alert" className="error-message">{message}</p>}
        </form>
      </section>
      <section className="map-area" aria-label="แผนที่เครือข่าย">
        <div className="map-toolbar">
          <div className="map-heading"><Icon name="layers" size={20} /><h2>แผนที่เครือข่าย</h2></div>
          {route && <a href="#directions" className="directions-link">ขั้นตอนการเดินทาง</a>}
          <div className="interchange-key"><span />จุดต่อสาย</div>
        </div>
        <div className="map-stage">
          <MapView route={route} activeLine={activeLine} selected={selected} onSelect={setSelected} />
          {selected && <StationCard key={selected} id={selected} activeLine={activeLine} onClose={() => setSelected(null)} onSet={useStation} />}
          <div className="map-attribution"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a> · <a href="https://pongsun-b.github.io/TravBhv/data/" target="_blank" rel="noreferrer">TBRG</a></div>
        </div>
        <div className="map-legend" aria-label="เน้นแต่ละสายรถไฟฟ้าบนแผนที่">
          <button type="button" aria-pressed={!activeLine} onClick={() => { setActiveLine(null); setRoute(null) }}>ทุกสาย</button>
          {lines.map(line => (
            <button type="button" key={line.id} aria-pressed={activeLine === line.id}
              onClick={() => { setActiveLine(activeLine === line.id ? null : line.id); setRoute(null) }}>
              <span className="line-dot" style={{ '--line-color': line.color }} />
              {line.name}
            </button>
          ))}
        </div>
      </section>
      <aside className="details" id="directions" aria-label="รายละเอียดการเดินทาง">
        {route ? <Directions route={route} onClear={() => setRoute(null)} /> : <>
          <h2>เส้นทางตัวอย่าง</h2>
          <button type="button" className="example-button" onClick={tryExample}>
            <Icon name="train" size={22} />
            <span><strong>สะพานควาย ถึง ลาดพร้าว 101</strong><small>N7 ถึง YL07 · BTS และ MRT</small></span>
          </button>
          <p className="map-hint"><Icon name="pin" size={19} />แตะจุดบนแผนที่เพื่อดูรหัสสถานีและสายที่เชื่อมต่อ</p>
        </>}
      </aside>
    </main>
    <DataDialog dialogRef={dialog} />
  </>
}

createRoot(document.getElementById('root')).render(<App />)
