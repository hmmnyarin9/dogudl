import { fromPreset, restore, storageKey, type Beat } from './beat-state';
import { hit, makeNoise, renderLoop, stepDuration } from './drum-audio';

const button = (id: string) => document.querySelector<HTMLButtonElement>(id)!;
const buttons = (selector: string) => Array.from(document.querySelectorAll<HTMLButtonElement>(selector));
const presets = buttons('[data-preset]');
const pads = buttons('.pad');
const modes = buttons('[data-mode]');
const swings = buttons('[data-swing]');
const audition = buttons('.audition');
const mutes = buttons('[data-mute]');
const volumes = document.querySelectorAll<HTMLInputElement>('[data-volume]');
const amounts = document.querySelectorAll<HTMLElement>('[data-volume-value]');
const heads = document.querySelectorAll<HTMLElement>('[data-head]');
const play = button('#play');
const undo = button('#undo');
const reset = button('#reset');
const tempo = document.querySelector<HTMLInputElement>('#tempo')!;
const position = document.querySelector<HTMLElement>('#position')!;
const notice = document.querySelector<HTMLElement>('#save-state')!;
let state = restore();
const history: Beat[] = [];
let refreshPlayback: ((previous: Beat) => void) | undefined;
let strengthMode = false;
let playing = false;
let generation = 0;
let timer: number | undefined;
let context: AudioContext;
let noise: AudioBuffer;
let bus: GainNode;

function remember() {
  history.push(structuredClone(state));
  if (history.length > 80) history.shift();
}
function save() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
    notice.textContent = '이 브라우저에 저장됨';
  } catch {
    notice.textContent = '브라우저 저장 공간을 사용할 수 없습니다.';
  }
}
function paint() {
  for (const pad of pads) {
    const level = state.pattern[Number(pad.dataset.row)][Number(pad.dataset.step)];
    pad.dataset.level = String(level);
    pad.textContent = '•'.repeat(level);
    pad.setAttribute('aria-pressed', String(level > 0));
    pad.setAttribute('aria-label', pad.dataset.label + ' · ' + ['꺼짐','약','중','강'][level]);
  }
  presets.forEach((b,i) => {
    b.setAttribute('aria-pressed', String(i === state.preset));
  });
  const edited = JSON.stringify(state) !== JSON.stringify(fromPreset(state.preset));
  document.querySelector('#pattern-name')!.textContent = presets[state.preset].textContent + (edited ? ' · 편집됨' : '');
  reset.disabled = !edited;
  undo.disabled = !history.length;
  tempo.value = String(state.bpm);
  document.querySelector('#bpm')!.textContent = tempo.value + ' BPM';
  swings.forEach((b,i) => b.setAttribute('aria-pressed', String(i === state.swing)));
  mutes.forEach((b,i) => {
    b.setAttribute('aria-pressed', String(state.muted[i]));
    volumes[i].value = String(state.volume[i]);
    amounts[i].textContent = state.volume[i] + '%';
  });
}
function commit() {
  paint();
  save();
}
function applyPreset(index: number) {
  remember();
  const previous = state;
  state = fromPreset(index);
  refreshPlayback?.(previous);
  commit();
}
presets.forEach((b,i) => b.onclick = () => {
  if (i !== state.preset) applyPreset(i);
});
reset.onclick = () => applyPreset(state.preset);
undo.onclick = () => {
  const previous = state;
  state = history.pop() ?? state;
  refreshPlayback?.(previous);
  commit();
};
function init() {
  if (!context) {
    context = new AudioContext();
    noise = makeNoise(context);
  }
  return context.resume();
}
function rowGain(row: number) {
  return state.muted[row] ? 0 : state.volume[row] / 100;
}
async function preview(row: number, level: number, solo = false) {
  await init();
  hit(context, noise, row, context.currentTime, context.destination, level, solo ? 1 : rowGain(row));
}
audition.forEach((b,row) => b.onclick = () => {
  void preview(row,2,true);
  const elements = [b,...pads.filter(p => Number(p.dataset.row) === row)];
  elements.forEach(el => el.classList.add('flash'));
  setTimeout(() => elements.forEach(el => el.classList.remove('flash')),140);
});
function mark(column: number) {
  heads.forEach((h,i) => h.classList.toggle('current', i === column));
  pads.forEach(p => p.classList.toggle('current', Number(p.dataset.step) === column));
}
function stop() {
  generation++;
  playing = false;
  refreshPlayback = undefined;
  clearInterval(timer);
  bus?.disconnect();
  mark(-1);
  play.textContent = '▶ 재생';
  position.textContent = '대기 중';
  paint();
}
play.onclick = async () => {
  if (playing) return stop();
  playing = true;
  const token = ++generation;
  try { await init(); } catch { stop(); position.textContent = '소리를 시작할 수 없습니다. 다시 재생해 주세요.'; return; }
  if (token !== generation) return;
  bus = context.createGain();
  bus.connect(context.destination);
  let step = 0;
  let next = context.currentTime + 0.025;
  let scheduledAt = -1;
  let scheduledColumn = 0;
  let marker: number | undefined;
  function schedule() {
    next = Math.max(next,context.currentTime);
    while (next < context.currentTime + 0.05) {
      const column = step;
      scheduledAt = next;
      scheduledColumn = column;
      state.pattern.forEach((track,row) => hit(context, noise, row, next, bus, track[column], rowGain(row)));
      marker = window.setTimeout(() => {
        if (token !== generation) return;
        mark(column);
        position.textContent = '재생 중 · ' + (Math.floor(column / 4) + 1) + '박 · ' + (column+1) + '/16';
      }, (next-context.currentTime)*1000);
      next += stepDuration(step,state.bpm,state.swing);
      step = (step+1) % 16;
    }
  }
  refreshPlayback = previous => {
    const now = context.currentTime;
    // The lookahead is shorter than one step, so at most one future hit needs replacing.
    if (scheduledAt > now) {
      clearTimeout(marker);
      step = scheduledColumn;
      next = scheduledAt;
    }
    const preceding = (step + 15) % 16;
    const oldDuration = stepDuration(preceding, previous.bpm, previous.swing);
    const remaining = Math.max(0, Math.min(1, (next - now) / oldDuration));
    next = now + remaining * stepDuration(preceding, state.bpm, state.swing);
    bus.disconnect();
    bus = context.createGain();
    bus.connect(context.destination);
    scheduledAt = -1;
    schedule();
  };
  play.textContent = '■ 정지';
  schedule();
  timer = window.setInterval(schedule,20);
};
window.addEventListener('pagehide',stop);

function setNote(pad: HTMLButtonElement, level: number) {
  const row = Number(pad.dataset.row);
  state.pattern[row][Number(pad.dataset.step)] = level;
  commit();
  if (level && !playing) void preview(row,level);
}
function noteLevel(pad: HTMLButtonElement) {
  return state.pattern[Number(pad.dataset.row)][Number(pad.dataset.step)];
}
function edit(pad: HTMLButtonElement, strength: boolean) {
  const level = noteLevel(pad);
  if (strength && !level) return;
  remember();
  setNote(pad, strength ? level % 3 + 1 : (level ? 0 : 2));
}
let brush: {row: string | undefined, level: number} | null = null;
let mouseEdited = false;
pads.forEach(pad => {
  pad.onpointerdown = e => {
    mouseEdited = false;
    if (e.pointerType !== 'mouse' || e.button !== 0 || e.shiftKey || strengthMode) return;
    mouseEdited = true;
    brush = {row: pad.dataset.row, level: noteLevel(pad) ? 0 : 2};
    remember();
    setNote(pad,brush.level);
  };
  pad.onpointerenter = e => {
    if (e.buttons === 1 && brush && pad.dataset.row === brush.row && noteLevel(pad) !== brush.level) setNote(pad,brush.level);
  };
  pad.onclick = e => {
    if (e.detail === 0 || !mouseEdited) edit(pad,strengthMode || e.shiftKey);
    mouseEdited = false;
  };
  pad.oncontextmenu = e => { e.preventDefault(); edit(pad,true); };
});
for (const event of ['pointerup','pointercancel','blur']) window.addEventListener(event, () => { brush = null; });
modes.forEach((b,i) => b.onclick = () => {
  strengthMode = i === 1;
  modes.forEach((mode,j) => mode.setAttribute('aria-pressed',String(j === i)));
});
swings.forEach((b,i) => b.onclick = () => {
  if (state.swing === i) return;
  remember();
  state.swing = i;
  commit();
});
mutes.forEach((b,i) => b.onclick = () => {
  remember();
  state.muted[i] = !state.muted[i];
  commit();
});
function slider(input: HTMLInputElement, change: (value: number) => void) {
  let editing = false;
  input.oninput = () => {
    if (!editing) remember();
    editing = true;
    change(Number(input.value));
    commit();
  };
  input.onchange = input.onblur = () => { editing = false; };
}
slider(tempo, value => { state.bpm = value; });
volumes.forEach((input,i) => slider(input,value => { state.volume[i] = value; }));
const download = button('#download');
download.onclick = async () => {
  download.disabled = true;
  try {
    const snapshot = structuredClone(state);
    const wav = await renderLoop(snapshot.pattern,snapshot.bpm,snapshot.swing,snapshot.volume.map((_,i) => rowGain(i)));
    const url = URL.createObjectURL(wav);
    const link = document.createElement('a');
    link.href = url;
    link.download = '도구들-' + presets[snapshot.preset].textContent + '-' + snapshot.bpm + 'bpm.wav';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url),60000);
  } catch {
    notice.textContent = 'WAV 파일을 만들지 못했습니다. 다시 시도해 주세요.';
  } finally { download.disabled = false; }
};
paint();
