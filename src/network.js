import source from './bangkok-open-data.json' with { type: 'json' }

const lineDesign = {
  sukhumvit: ['BTS', 'สุขุมวิท', 'เขียวอ่อน', '#5c8c1a'],
  silom: ['BTS', 'สีลม', 'เขียวเข้ม', '#007f65'],
  blue: ['MRT', 'สีน้ำเงิน', 'น้ำเงิน', '#26579e'],
  purple: ['MRT', 'สีม่วง', 'ม่วง', '#8053a1'],
  arl: ['ARL', 'Airport Rail Link', 'แอร์พอร์ต เรล ลิงก์', '#b14652'],
  pink: ['MRT', 'สีชมพู', 'ชมพู', '#c84f87'],
  yellow: ['MRT', 'สีเหลือง', 'เหลือง', '#d49a00'],
}

export const lines = source.lines.map(line => {
  const [operator, name, colorName, color] = lineDesign[line.id]
  return { ...line, operator, name, colorName, color }
})
export const lineById = Object.fromEntries(lines.map(line => [line.id, line]))
const codeByLine = {
  sukhumvit: { siam: 'CEN' },
  silom: { siam: 'CEN', 'national-stadium': 'W1' },
  blue: {},
  purple: {},
}

const north = lineById.sukhumvit.sequences[0].slice(
  lineById.sukhumvit.sequences[0].indexOf('ha-yaek-lat-phrao'),
)
north.forEach((id, index) => { codeByLine.sukhumvit[id] = 'N' + (9 + index) })
const blueStops = [...new Set(lineById.blue.sequences[0])]
blueStops.forEach((id, index) => { codeByLine.blue[id] = 'BL' + String(index + 1).padStart(2, '0') })
lineById.purple.sequences[0].forEach((id, index) => {
  codeByLine.purple[id] = 'PP' + String(16 - index).padStart(2, '0')
})

const aliases = {
  'chatuchak-park': 'จตุจักร สวนจตุจักร Jatujak',
  'ha-yaek-lat-phrao': '5 แยกลาดพร้าว ห้าแยกลาดพร้าว Lat Phrao Ladprao',
  'lat-phrao': 'ลาดพร้าว Lad Phrao Ladprao',
  'lat-phrao-101': 'ลาดพร้าว101 Lad Phrao 101 Ladprao 101',
  'lat-phrao-71': 'ลาดพร้าว71 Lad Phrao 71 Ladprao 71',
  'lat-phrao-83': 'ลาดพร้าว83 Lad Phrao 83 Ladprao 83',
  'phahon-yothin': 'พหลโยธิน Phahonyothin',
  'saphan-khwai': 'สะพานควาย Saphan Kwai',
  suvarnabhumi: 'สนามบินสุวรรณภูมิ BKK Airport',
  siam: 'สยาม Siam Central',
  'si-lom': 'สีลม Silom',
}

const thaiNames = { 'saint-louis': 'เซนต์หลุยส์' }

export const stations = source.stations.map(station => ({
  id: station.id,
  name: thaiNames[station.id] ?? station.name ?? station['name:en'] ?? station.id,
  en: station['name:en'] || station.id.replaceAll('-', ' '),
  lat: station.lat,
  lon: station.lon,
  lineIds: station.lines,
}))
export const stationById = Object.fromEntries(stations.map(station => [station.id, station]))
export const stopKey = (stationId, lineId) => lineId + ':' + stationId
export const stops = source.stations.flatMap(station => station.lines.map(lineId => ({
  ...stationById[station.id],
  key: stopKey(station.id, lineId),
  lineId,
  code: codeByLine[lineId]?.[station.id] ?? station.refs?.[lineId],
  aliases: aliases[station.id] || '',
})))
export const stopByKey = Object.fromEntries(stops.map(stop => [stop.key, stop]))

// Cross-operator connections and separately named stations are explicit.
const connections = [
  ['siam', 'sukhumvit', 'siam', 'silom', 'within'],
  ['tao-poon', 'blue', 'tao-poon', 'purple', 'within'],
  ['samrong', 'sukhumvit', 'samrong', 'yellow'],
  ['lat-phrao', 'blue', 'lat-phrao', 'yellow'],
  ['phaya-thai', 'sukhumvit', 'phaya-thai', 'arl'],
  ['wat-phra-sri-mahathat', 'sukhumvit', 'wat-phra-sri-mahathat', 'pink'],
  ['bang-wa', 'silom', 'bang-wa', 'blue'],
  ['nonthaburi-civic-center', 'purple', 'nonthaburi-civic-center', 'pink'],
  ['hua-mak', 'arl', 'hua-mak', 'yellow'],
  ['mo-chit', 'sukhumvit', 'chatuchak-park', 'blue'],
  ['ha-yaek-lat-phrao', 'sukhumvit', 'phahon-yothin', 'blue'],
  ['asok', 'sukhumvit', 'sukhumvit', 'blue'],
  ['sala-daeng', 'silom', 'si-lom', 'blue'],
  ['makkasan', 'arl', 'phetchaburi', 'blue'],
]

export const transfers = connections.map(([sidA, lidA, sidB, lidB, type = 'walk']) => ({
  from: stopByKey[stopKey(sidA, lidA)],
  to: stopByKey[stopKey(sidB, lidB)],
  type,
}))
export const transferStationIds = new Set(transfers.flatMap(({from, to}) => [from.id, to.id]))

export function stationConnections(stationId) {
  return transfers.flatMap(({ from, to, type }) => {
    if (from.id === stationId) return [{ from, to, type }]
    if (to.id === stationId) return [{ from: to, to: from, type }]
    return []
  })
}

const normalize = value => value.toLowerCase().replace(/[\s.\-_]/g, '')
export function searchStops(query) {
  const term = normalize(query.trim())
  if (!term) return []
  return stops
    .map(stop => {
      const values = [stop.code, stop.name, stop.en].filter(Boolean).map(normalize)
      if (values.includes(term)) return [0, stop]
      if (values.some(value => value.startsWith(term))) return [1, stop]
      if (values.some(value => value.includes(term)) || normalize(stop.aliases).includes(term)) return [2, stop]
      return [Infinity, stop]
    })
    .filter(([rank]) => Number.isFinite(rank))
    .sort(([a, stopA], [b, stopB]) => a - b || stopA.name.localeCompare(stopB.name, 'th'))
    .map(([, stop]) => stop)
}

export const example = {
  from: stopKey('saphan-khwai', 'sukhumvit'),
  to: stopKey('lat-phrao-101', 'yellow'),
}
