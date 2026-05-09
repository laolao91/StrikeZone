const PITCH_TYPE_MAP: Record<string, string> = {
  FF: '4-Seam FF',
  SI: 'Sinker SI',
  FC: 'Cutter FC',
  FS: 'Splitter FS',
  SL: 'Slider SL',
  ST: 'Sweeper ST',
  SV: 'Slurve SV',
  CH: 'Change CH',
  CU: 'Curve CU',
  KC: 'KnCurve KC',
  KN: 'Knuckle KN',
  EP: 'Eephus EP',
  FO: 'Fork FO',
}

export function formatPitchType(code: string, description: string): string {
  if (PITCH_TYPE_MAP[code]) return PITCH_TYPE_MAP[code]
  const fallbackDesc = description.trim() || code
  return `${fallbackDesc} ${code}`
}
