interface ZoneSvgProps {
  pX: number
  pZ: number
  szTop: number
  szBot: number
}

export function ZoneSvg({ pX, pZ, szTop, szBot }: ZoneSvgProps) {
  const W = 240, H = 300
  const PX_MIN = -2, PX_MAX = 2, PZ_MIN = 0.5, PZ_MAX = 5.5
  const scaleX = W / (PX_MAX - PX_MIN)
  const scaleY = H / (PZ_MAX - PZ_MIN)
  const toX = (px: number) => (px - PX_MIN) * scaleX
  const toY = (pz: number) => H - (pz - PZ_MIN) * scaleY

  const zL = toX(-0.83), zR = toX(0.83)
  const zT = toY(szTop), zB = toY(szBot)
  const zW = zR - zL, zH = zB - zT

  const dotX = Math.max(6, Math.min(W - 6, toX(pX)))
  const dotY = Math.max(6, Math.min(H - 6, toY(pZ)))
  const inZone = pX >= -0.83 && pX <= 0.83 && pZ >= szBot && pZ <= szTop

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[180px] mx-auto block">
      {/* zone outline */}
      <rect x={zL} y={zT} width={zW} height={zH} fill="none" stroke="#22c55e" strokeWidth="2" />
      {/* thirds grid */}
      {[1, 2].map(n => (
        <g key={n}>
          <line x1={zL} y1={zT + zH * n / 3} x2={zR} y2={zT + zH * n / 3}
            stroke="#22c55e" strokeWidth="0.5" strokeOpacity="0.35" />
          <line x1={zL + zW * n / 3} y1={zT} x2={zL + zW * n / 3} y2={zB}
            stroke="#22c55e" strokeWidth="0.5" strokeOpacity="0.35" />
        </g>
      ))}
      {/* home plate */}
      <path d={`M ${W/2 - 12} ${H - 8} L ${W/2 + 12} ${H - 8} L ${W/2 + 12} ${H - 4} L ${W/2} ${H} L ${W/2 - 12} ${H - 4} Z`}
        fill="#6b7280" />
      {/* pitch dot */}
      <circle cx={dotX} cy={dotY} r={9}
        fill={inZone ? '#ef4444' : '#f97316'}
        stroke="white" strokeWidth="1.5" />
    </svg>
  )
}
