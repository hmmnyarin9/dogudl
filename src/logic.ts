export function videoId(input: string) {
  try {
    const url = new URL(/^https?:\/\//i.test(input) ? input : 'https://' + input);
    const host = url.hostname.replace(/^(www\.|m\.)/, '');
    const parts = url.pathname.split('/');
    const id = host === 'youtu.be' ? parts[1] : host === 'youtube.com' ?
      (url.pathname === '/watch' ? url.searchParams.get('v') : parts[1] === 'shorts' ? parts[2] : null) : null;
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}
export function seconds(value: string) {
  if (!/^(?:\d+:)?\d+(?:\.\d{1,3})?$/.test(value)) return NaN;
  const parts = value.split(':').map(Number);
  if (parts.length === 1) return parts[0];
  return parts[1] < 60 ? parts[0]*60 + parts[1] : NaN;
}
export function validRange(a: number, b: number, duration: number) {
  return a >= 0 && b > a && b <= duration;
}
export function timestamp(time: number) {
  const ms = Math.floor(time * 1000);
  return Math.floor(ms / 60000) + ':' + String(Math.floor(ms / 1000) % 60).padStart(2,'0') + (ms % 1000 ? '.' + String(ms % 1000).padStart(3,'0').replace(/0+$/,'') : '');
}
