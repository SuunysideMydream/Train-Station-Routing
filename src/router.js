import { lines, stationById, stopByKey, stopKey, transfers } from './network.js'

const graph = new Map()
const nodesByStop = new Map()
const nodeKey = (lineId, sequenceIndex, position) => [lineId, sequenceIndex, position].join('/')

function addEdge(from, to, details) {
  graph.get(from).push({ to, from, ...details })
}

for (const line of lines) {
  line.sequences.forEach((sequence, sequenceIndex) => {
    sequence.forEach((id, position) => {
      const node = nodeKey(line.id, sequenceIndex, position)
      const stop = stopKey(id, line.id)
      graph.set(node, [])
      if (!nodesByStop.has(stop)) nodesByStop.set(stop, [])
      nodesByStop.get(stop).push(node)
    })
    sequence.slice(1).forEach((id, index) => {
      const a = nodeKey(line.id, sequenceIndex, index)
      const b = nodeKey(line.id, sequenceIndex, index + 1)
      addEdge(a, b, { type: 'ride', lineId: line.id, stations: [sequence[index], id], heading: sequence.at(-1), walking: 0 })
      addEdge(b, a, { type: 'ride', lineId: line.id, stations: [id, sequence[index]], heading: sequence[0], walking: 0 })
    })
  })
}

for (const { from, to, type } of transfers) {
  const walking = type === 'within' ? 50 : 150 + 110000 * Math.hypot(from.lat - to.lat, (from.lon - to.lon) * 0.972)
  for (const a of nodesByStop.get(from.key)) {
    for (const b of nodesByStop.get(to.key)) {
      addEdge(a, b, { type, fromStop: from.key, toStop: to.key, walking })
      addEdge(b, a, { type, fromStop: to.key, toStop: from.key, walking })
    }
  }
}

// Tha Phra appears twice on the Blue Line service. Changing between those
// occurrences requires a train change even though the station code is the same.
const thaPhra = stopKey('tha-phra', 'blue')
const [firstThaPhra, secondThaPhra] = nodesByStop.get(thaPhra)
addEdge(firstThaPhra, secondThaPhra, { type: 'reboard', fromStop: thaPhra, toStop: thaPhra, walking: 50 })
addEdge(secondThaPhra, firstThaPhra, { type: 'reboard', fromStop: thaPhra, toStop: thaPhra, walking: 50 })

function compare(a, b, mode) {
  if (mode === 'stops') {
    return a.stops - b.stops || a.changes - b.changes || a.walking - b.walking
  }
  return a.changes - b.changes || a.stops - b.stops || a.walking - b.walking
}

function makeLegs(edges) {
  const legs = []
  for (const edge of edges) {
    if (edge.type !== 'ride') {
      legs.push({ type: edge.type, from: stopByKey[edge.fromStop], to: stopByKey[edge.toStop] })
      continue
    }
    const last = legs.at(-1)
    if (last?.type === 'ride') {
      last.stations.push(edge.stations[1])
    } else {
      legs.push({ type: 'ride', lineId: edge.lineId, heading: stationById[edge.heading], stations: [...edge.stations] })
    }
  }
  return legs
}

export function findRoute(fromKey, toKey, mode = 'stops') {
  const starts = nodesByStop.get(fromKey)
  const goals = new Set(nodesByStop.get(toKey))
  if (!starts?.length || !goals.size) return null

  const best = new Map(starts.map(node => [node, { stops: 0, changes: 0, walking: 0 }]))
  const previous = new Map()
  const queue = new Set(starts)
  while (queue.size) {
    let current
    for (const node of queue) {
      if (!current || compare(best.get(node), best.get(current), mode) < 0) current = node
    }
    queue.delete(current)
    const cost = best.get(current)
    if (goals.has(current)) {
      const edges = []
      let node = current
      while (previous.has(node)) {
        const edge = previous.get(node)
        edges.push(edge)
        node = edge.from
      }
      edges.reverse()
      return { ...cost, legs: makeLegs(edges), from: stopByKey[fromKey], to: stopByKey[toKey] }
    }
    for (const edge of graph.get(current)) {
      const ride = edge.type === 'ride'
      const candidate = {
        stops: cost.stops + Number(ride),
        changes: cost.changes + Number(!ride),
        walking: cost.walking + edge.walking,
      }
      if (best.has(edge.to) && compare(candidate, best.get(edge.to), mode) >= 0) continue
      best.set(edge.to, candidate)
      previous.set(edge.to, edge)
      queue.add(edge.to)
    }
  }
  return null
}
