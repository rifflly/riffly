/**
 * Waveform strip with draggable A/B loop markers and a playhead (Phase 3 item 2).
 *
 * The waveform is rendered once to a canvas from the decoded AudioBuffer peaks;
 * the A/B handles, loop region, and playhead are lightweight DOM overlays so we
 * never redraw the canvas per frame. Positions are kept in track seconds.
 */
import { el } from './dom.js';

const HEIGHT = 84;

export function createWaveform(buffer, { onLoopChange } = {}) {
  const duration = buffer.duration;
  let a = 0;
  let b = duration;

  const canvas = el('canvas', { class: 'wave-canvas' });
  const region = el('div', { class: 'wave-region' });
  const handleA = el('div', { class: 'wave-handle wave-handle--a', role: 'slider', 'aria-label': 'Loop start' });
  const handleB = el('div', { class: 'wave-handle wave-handle--b', role: 'slider', 'aria-label': 'Loop end' });
  const playhead = el('div', { class: 'wave-playhead' });
  const container = el('div', { class: 'waveform' }, canvas, region, handleA, handleB, playhead);

  const pct = (sec) => `${(sec / duration) * 100}%`;

  function layout() {
    region.style.left = pct(a);
    region.style.width = `${((b - a) / duration) * 100}%`;
    handleA.style.left = pct(a);
    handleB.style.left = pct(b);
  }

  function draw() {
    const w = container.clientWidth;
    if (!w) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = HEIGHT * dpr;
    canvas.style.height = `${HEIGHT}px`;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, HEIGHT);
    const color = getComputedStyle(document.documentElement).getPropertyValue('--color-secondary').trim() || '#7b6ba8';
    ctx.fillStyle = color;

    const data = buffer.getChannelData(0);
    const step = Math.max(1, Math.floor(data.length / w));
    const mid = HEIGHT / 2;
    for (let x = 0; x < w; x++) {
      let min = 1;
      let max = -1;
      const start = x * step;
      for (let j = 0; j < step; j++) {
        const v = data[start + j] || 0;
        if (v < min) min = v;
        if (v > max) max = v;
      }
      const y1 = mid - max * mid;
      const y2 = mid - min * mid;
      ctx.fillRect(x, y1, 1, Math.max(1, y2 - y1));
    }
  }

  // Redraw once the element has a width (and on resize).
  const ro = new ResizeObserver(() => draw());
  ro.observe(container);

  // ---- Dragging the handles --------------------------------------------
  function secFromClientX(clientX) {
    const rect = container.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return frac * duration;
  }

  function startDrag(which) {
    return (e) => {
      e.preventDefault();
      const move = (ev) => {
        const sec = secFromClientX(ev.touches ? ev.touches[0].clientX : ev.clientX);
        if (which === 'a') a = Math.min(sec, b - 0.05);
        else b = Math.max(sec, a + 0.05);
        a = Math.max(0, a);
        b = Math.min(duration, b);
        layout();
        if (onLoopChange) onLoopChange({ a, b });
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    };
  }
  handleA.addEventListener('pointerdown', startDrag('a'));
  handleB.addEventListener('pointerdown', startDrag('b'));

  layout();

  return {
    node: container,
    getLoop: () => ({ a, b }),
    setLoopActive: (on) => container.classList.toggle('is-looping', on),
    setPlayhead: (sec) => {
      playhead.style.left = pct(Math.min(duration, Math.max(0, sec)));
    },
    redraw: draw,
    destroy: () => ro.disconnect(),
  };
}
