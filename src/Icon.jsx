const shapes = {
  rail: <><path d="M5 21 9 3m6 18 4-18M6.5 15h10m-8-6h10m-9.5-6h10" /><circle cx="13" cy="9" r="2.5" fill="currentColor" stroke="none" /></>,
  train: <><rect x="6" y="3" width="12" height="14" rx="3" /><path d="M6 10h12m-8 7-3 4m7-4 3 4M9 14h.01M15 14h.01M12 3v7" /></>,
  route: <><circle cx="5" cy="6" r="2" /><circle cx="19" cy="18" r="2" /><path d="M7 6h7a3 3 0 1 1 0 6H9a3 3 0 1 0 0 6h8" /></>,
  swap: <><path d="M8 5v14m-3-3 3 3 3-3M16 19V5m-3 3 3-3 3 3" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  move: <><path d="M12 3v18M3 12h18M9 6l3-3 3 3m-6 12 3 3 3-3M6 9l-3 3 3 3m12-6 3 3-3 3" /></>,
  fit: <><path d="M9 4H4v5m11-5h5v5m0 6v5h-5m-6 0H4v-5" /><circle cx="12" cy="12" r="2" /></>,
  map: <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  walk: <><circle cx="14" cy="4" r="2" /><path d="m8 21 2.5-6m3.5 6-1-5.5-3-3 .9-3.5 2.1-1 2.5 3 3 .5M11 9 7 11l-1 3" /></>,
  pin: <><path d="M19 10c0 5-7 10-7 10s-7-5-7-10a7 7 0 0 1 14 0Z" /><circle cx="12" cy="10" r="2" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></>,
  layers: <><path d="m12 4 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 17l9 5 9-5" /></>,
  compass: <path d="m12 3 5 15-5-3-5 3 5-15Z" />,
}

export function Icon({ name, size = 20, ...props }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}>
    {shapes[name]}
  </svg>
}
