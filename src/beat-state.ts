const grooves = [
  { bpm: 92, hits: [[0,7,10],[4,12],[0,2,4,6,8,10,12,14],[15],[]] },
  { bpm: 124, hits: [[0,4,8,12],[4,12],[0,4,8,12],[2,6,10,14],[12]] },
  { bpm: 144, hits: [[0,3,10,14],[8],[0,2,4,6,8,10,12,13,14,15],[6],[8]] },
  { bpm: 100, hits: [[],[],[],[],[]] }
];

export function fromPreset(preset: number) {
  const {bpm, hits} = grooves[preset];
  return {
    preset, bpm, swing: 0,
    pattern: hits.map(track => Array.from({length:16}, (_,i):number => track.includes(i) ? 2 : 0)),
    volume: hits.map(() => 100), muted: hits.map(() => false)
  };
}
export type Beat = ReturnType<typeof fromPreset>;
export const storageKey = 'dogudl.beat.v1';
export function restore(): Beat {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || 'null');
    const integer = (n: unknown, low: number, high: number) => typeof n === 'number' && Number.isInteger(n) && n >= low && n <= high;
    const five = (list: unknown, valid: (n: unknown) => boolean) => Array.isArray(list) && list.length === 5 && list.every(valid);
    if (value && integer(value.preset,0,3) && integer(value.bpm,50,200) && integer(value.swing,0,2)
      && five(value.pattern, row => Array.isArray(row) && row.length === 16 && row.every(n => integer(n,0,3)))
      && five(value.volume, n => integer(n,0,100)) && five(value.muted, n => typeof n === 'boolean')) return value;
  } catch { /* Storage may be unavailable. */ }
  return fromPreset(0);
}
