/** Y-axis ticks for counts: about three intervals with a "nice" integer step. */
export function niceTicks(max: number): { ticks: number[]; top: number } {
  const raw = Math.max(max, 1) / 3
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow)
  const top = step * Math.max(1, Math.ceil(max / step))
  const ticks: number[] = []
  for (let v = 0; v <= top; v += step) ticks.push(v)
  return { ticks, top }
}
