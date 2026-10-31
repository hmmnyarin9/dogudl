import {videoId, seconds, validRange, timestamp} from './logic';
declare global { interface Window { onYouTubeIframeAPIReady?: () => void } }
const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const start = get<HTMLInputElement>('A'), end = get<HTMLInputElement>('B');
const controls = get<HTMLFieldSetElement>('controls'), loop = get<HTMLButtonElement>('loop');
const status = get('status'), rates = get('rates');
let player: YT.Player | undefined;
let version = 0, looping = false, timer = 0;
let loading: Promise<void> | undefined;

function loadApi() {
  if (typeof YT !== 'undefined' && YT.Player) return Promise.resolve();
  if (!loading) loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    const fail = () => { script.remove(); loading = undefined; reject(new Error('API')); };
    const timeout = window.setTimeout(fail, 15000);
    window.onYouTubeIframeAPIReady = () => { clearTimeout(timeout); resolve(); };
    script.onerror = () => { clearTimeout(timeout); fail(); };
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.append(script);
  });
  return loading;
}
function setLoop(on: boolean) {
  looping = on;
  loop.textContent = on ? '반복 끄기' : '반복 켜기';
  loop.setAttribute('aria-pressed', String(on));
}
function applyRange() {
  if (!player) return;
  const a = seconds(start.value), b = seconds(end.value);
  if (!validRange(a,b,player.getDuration())) {
    setLoop(false);
    status.textContent = '영상 길이 안에서 시작점보다 뒤에 끝점을 지정해 주세요.';
    return;
  }
  setLoop(true);
  player.seekTo(a,true);
  player.playVideo();
  status.textContent = start.value + ' – ' + end.value + ' 구간을 반복합니다.';
}
function showRates(p: YT.Player) {
  rates.replaceChildren(...p.getAvailablePlaybackRates().map(rate => {
    const button = document.createElement('button');
    button.textContent = rate + '×';
    button.setAttribute('aria-pressed', String(rate === p.getPlaybackRate()));
    button.onclick = () => p.setPlaybackRate(rate);
    return button;
  }));
}
get('open').onsubmit = async event => {
  event.preventDefault();
  const id = videoId(get<HTMLInputElement>('url').value.trim());
  if (!id) { status.textContent = '유튜브 영상 링크를 확인해 주세요.'; return; }
  const current = ++version;
  clearInterval(timer);
  player?.destroy(); player = undefined;
  setLoop(false); start.value = ''; end.value = ''; controls.disabled = true; rates.replaceChildren();
  const host = document.createElement('div');
  document.querySelector('.video')!.replaceChildren(host);
  status.textContent = '영상을 불러오는 중입니다…';
  try {
    await loadApi();
    if (current !== version) return;
    player = new YT.Player(host,{videoId:id, playerVars:{playsinline:1,origin:location.origin},events:{
      onReady: ({target}) => {
        if (current !== version) return;
        controls.disabled = false; showRates(target);
        status.textContent = '재생 후 시작점 A와 끝점 B를 차례로 찍어 주세요.';
      },
      onPlaybackRateChange: ({target}) => { if (current === version) showRates(target); },
      onStateChange: ({data,target}) => {
        if (current !== version) return;
        clearInterval(timer);
        if (data === YT.PlayerState.ENDED && looping) { target.seekTo(seconds(start.value),true); target.playVideo(); }
        if (data === YT.PlayerState.PLAYING) {
          showRates(target);
          timer = window.setInterval(() => {
            if (looping && target.getCurrentTime() >= seconds(end.value)) target.seekTo(seconds(start.value),true);
          }, 80);
        }
      },
      onError: () => {
        if (current !== version) return;
        clearInterval(timer); setLoop(false); controls.disabled = true; rates.replaceChildren();
        status.textContent = '이 영상을 재생할 수 없습니다. 공개 상태와 외부 재생 허용 여부를 확인해 주세요.';
      }
    }});
  } catch { if (current === version) status.textContent = '플레이어 연결에 실패했습니다. 영상 열기를 다시 눌러 주세요.'; }
};
get('markA').onclick = () => {
  if (!player) return;
  start.value = timestamp(player.getCurrentTime()); setLoop(false);
  status.textContent = '시작점을 지정했습니다. 끝점 B를 찍어 주세요.';
};
get('markB').onclick = () => { if (player) { end.value = timestamp(player.getCurrentTime()); applyRange(); } };
for (const input of [start,end]) input.oninput = () => { setLoop(false); status.textContent = '시간을 입력한 뒤 반복 켜기를 눌러 주세요.'; };
loop.onclick = () => { if (looping) { setLoop(false); status.textContent = '반복을 껐습니다.'; } else applyRange(); };

