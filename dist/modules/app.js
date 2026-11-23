import { stripProfile } from './profile.js';
import { loadRecords, saveRecords } from './storage.js';
import { samplePatch, classifyColour, waterType } from './colour.js';
import { StripCamera, imageDataFromFile } from './camera.js';

const app = document.querySelector('#app');
const toast = document.querySelector('#toast');
const state = { records: loadRecords(), step: 0, capture: null, target: { x: 0.5, y: 0.5 }, camera: null, timerId: null };
const TARGET_SIZE = 0.14;
let lastPage = '';
let audioContext = null;

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const formatDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const showToast = (message) => { toast.textContent = message; toast.hidden = false; setTimeout(() => { toast.hidden = true; }, 3600); };
const commit = () => saveRecords(state.records) || showToast('This device could not save your result.');
const progress = () => `<div class="progress" aria-label="Step ${state.step + 1} of 4">${[0, 1, 2, 3].map((index) => `<span class="${index <= state.step ? 'done' : ''}"></span>`).join('')}</div>`;
const clearTimer = () => { if (state.timerId) { clearInterval(state.timerId); state.timerId = null; } };
const resetTest = () => { clearTimer(); state.camera?.close(); state.camera = null; state.step = 0; state.capture = null; state.target = { x: 0.5, y: 0.5 }; };
const clampTarget = (value) => Math.min(1 - TARGET_SIZE / 2, Math.max(TARGET_SIZE / 2, value));
const prepareChime = () => {
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return;
  audioContext = audioContext || new Context();
  if (audioContext.state === 'suspended') audioContext.resume();
};
const playChime = () => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  prepareChime();
  if (!audioContext) return;
  const start = audioContext.currentTime + 0.02;
  [523.25, 659.25, 783.99].forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const note = start + index * 0.16;
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, note);
    gain.gain.exponentialRampToValueAtTime(0.08, note + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, note + 0.22);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(note);
    oscillator.stop(note + 0.24);
  });
};
const focusStep = (root = app) => {
  const target = root.querySelector('h1, .primary, button, a');
  if (!target) return;
  target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
};

function header(title, description = '') {
  return `<div class="page-head"><div><span class="eyebrow">AquaCheck</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div></div>`;
}

function colourChart(matchedPh) {
  const cells = stripProfile.colors.map(({ ph, color }) => {
    const matched = Number(ph) === Number(matchedPh);
    return `<li class="${matched ? 'matched' : ''}"><span style="background:${escapeHtml(color)}"></span><b>${escapeHtml(ph)}</b></li>`;
  }).join('');
  return `<div class="chart-wrap"><p class="chart-label">Where it sits on the chart</p><ol class="chart" aria-label="pH 1 to 14 colour chart. pH ${escapeHtml(matchedPh)} is marked.">${cells}</ol></div>`;
}

function resultView(record) {
  const type = waterType(record.ph);
  return `<div class="result-number">${escapeHtml(record.ph)}<small>estimated pH</small></div><div class="result-colour"><span style="background:${escapeHtml(record.color)}" aria-label="Colour read from your strip"></span><small>Colour read from your strip</small></div>${colourChart(record.ph)}<section class="result-status ${escapeHtml(type.tone)}"><h2>${escapeHtml(type.title)}</h2><p>${escapeHtml(type.detail)}</p></section><p class="single-note">A normal pH does not automatically mean the water is safe to drink.</p>`;
}

function home() {
  app.innerHTML = `${header('Snap your strip. Discover the pH.', 'Take a clear photo and AquaCheck reads the strip colour.')}<a class="primary large" href="#test">Test my water</a><div class="home-links"><a href="#history">My results<small>See saved tests</small></a><a href="#learn">Learn<small>Explore pH science</small></a></div>`;
  focusStep();
}

function test() {
  state.camera?.close();
  if (state.step === 3 && !state.capture) state.step = 2;
  app.innerHTML = `<a class="back" href="#home">Home</a><main class="test-card">${progress()}<div id="step-content"></div></main>`;
  const content = document.querySelector('#step-content');
  if (state.step === 0) {
    content.innerHTML = `<h1>Get your strip ready.</h1><ol class="steps"><li>Pour water into a clean cup.</li><li>Take out one pH strip.</li><li>Find a bright place without glare.</li></ol><button class="primary large" id="continue">I’m ready</button>`;
    document.querySelector('#continue').onclick = () => { state.step = 1; test(); };
  } else if (state.step === 1) {
    waitStep(content);
  } else if (state.step === 2) {
    cameraStep(content);
  } else {
    resultStep(content);
  }
  focusStep(content);
}

function waitStep(content) {
  clearTimer();
  content.innerHTML = `<h1>Dip. Then wait.</h1><p>Follow the time shown on your strip pack.</p><label>Wait time in seconds<input id="wait" type="number" value="30" min="1" max="600"></label><div class="timer" id="timer" aria-live="polite">30s</div><button class="primary large" id="start-timer">Start waiting</button><button class="primary large" id="next" hidden>Snap my strip</button><button class="secondary" id="skip-wait">I’ve already waited</button>`;
  const goToCamera = () => { clearTimer(); state.step = 2; test(); };
  document.querySelector('#start-timer').onclick = () => {
    clearTimer();
    let seconds = Number(document.querySelector('#wait').value);
    if (!Number.isInteger(seconds) || seconds < 1 || seconds > 600) return showToast('Enter a time from 1 to 600 seconds.');
    prepareChime();
    document.querySelector('#start-timer').disabled = true;
    document.querySelector('#wait').disabled = true;
    document.querySelector('#timer').textContent = `${seconds}s`;
    state.timerId = setInterval(() => {
      seconds -= 1;
      const timer = document.querySelector('#timer');
      const next = document.querySelector('#next');
      if (!timer || !next) return clearTimer();
      timer.textContent = `${seconds}s`;
      if (seconds <= 0) {
        clearTimer();
        next.hidden = false;
        try { playChime(); } catch { /* A blocked speaker should not stop the test. */ }
        next.focus({ preventScroll: true });
      }
    }, 1000);
  };
  document.querySelector('#next').onclick = goToCamera;
  document.querySelector('#skip-wait').onclick = goToCamera;
}

async function cameraStep(content) {
  content.innerHTML = `<h1>Snap your strip.</h1><p>Place the strip on white paper. Drag the square onto the coloured part.</p><div class="camera-box"><video id="camera" autoplay muted playsinline></video><img id="upload-preview" alt="Uploaded strip photo" hidden><span class="target" tabindex="0" aria-label="Sampling square. Drag it onto the coloured part, or use the arrow keys."></span></div><button class="primary large" id="snap" disabled>Snap</button><button class="primary large" id="read-upload" type="button" hidden>Read this photo</button><label class="upload-label secondary"><input id="upload" type="file" accept="image/*">Upload a photo instead</label><button class="secondary" id="use-camera" type="button" hidden>Use camera</button><p id="camera-message" role="status">Opening your camera…</p>`;
  const video = document.querySelector('#camera');
  const preview = document.querySelector('#upload-preview');
  const message = document.querySelector('#camera-message');
  const snap = document.querySelector('#snap');
  const readUpload = document.querySelector('#read-upload');
  const useCamera = document.querySelector('#use-camera');
  let uploaded = null;
  state.camera = new StripCamera(video);
  bindTarget(content.querySelector('.camera-box'));

  const showMessage = (text, asToast = false) => {
    message.textContent = text;
    if (asToast) showToast(text);
  };

  const showLiveCamera = async () => {
    await state.camera.open();
    preview.hidden = true;
    preview.removeAttribute('src');
    video.hidden = false;
    snap.disabled = false;
    readUpload.hidden = true;
    uploaded = null;
    useCamera.hidden = true;
    showMessage('Drag the square onto the coloured part, hold still, then press Snap.');
  };

  const visibleMedia = () => (preview.hidden ? video : preview);
  const analyse = (imageData) => {
    const patch = samplePatch(imageData, imagePoint(visibleMedia(), imageData, state.target));
    if (patch.error) {
      showMessage(patch.error, true);
      return false;
    }
    const result = classifyColour(patch.rgb, stripProfile);
    if (result.error) {
      showMessage(result.error, true);
      return false;
    }
    state.capture = result;
    state.step = 3;
    test();
    return true;
  };

  try {
    await showLiveCamera();
  } catch {
    video.hidden = true;
    snap.disabled = true;
    showMessage('Camera is unavailable. Upload a clear photo of your strip instead.');
  }

  snap.onclick = () => {
    try {
      analyse(state.camera.capture().image);
    } catch (error) {
      showMessage(error.message, true);
    }
  };

  readUpload.onclick = () => {
    if (!uploaded) return;
    if (!analyse(uploaded.image) && state.step === 2) {
      showMessage(`${message.textContent} Move the square, then read the photo again.`);
    }
  };

  useCamera.onclick = async () => {
    try {
      await showLiveCamera();
    } catch {
      showMessage('Camera is unavailable. Upload a clear photo of your strip instead.', true);
    }
  };

  document.querySelector('#upload').onchange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const capture = await imageDataFromFile(file);
      state.camera?.close();
      video.hidden = true;
      preview.src = capture.canvas.toDataURL('image/jpeg', 0.85);
      preview.hidden = false;
      snap.disabled = true;
      uploaded = capture;
      readUpload.hidden = false;
      useCamera.hidden = false;
      showMessage('Drag the square onto the coloured part, then read this photo.');
    } catch (error) {
      showMessage(error.message, true);
    }
  };
}

function resultStep(content) {
  if (!state.capture) {
    state.step = 2;
    return cameraStep(content);
  }
  const record = { ph: state.capture.ph, color: state.capture.color };
  content.innerHTML = `<div class="center"><span class="eyebrow">Your water result</span><h1>Here’s what your strip shows.</h1>${resultView(record)}<label class="source-field">Water source<input id="source" maxlength="40" placeholder="School well" autocomplete="off"></label><button class="primary large" id="save">Save my result</button><button class="secondary large" id="snap-again">Snap again</button><button class="secondary" id="again">Start over</button></div>`;
  document.querySelector('#save').onclick = () => {
    const source = document.querySelector('#source').value.trim();
    if (!source) return showToast('Name the water you tested, such as School well.');
    state.records.unshift({ id: crypto.randomUUID(), created: new Date().toISOString(), source, ...record });
    commit();
    resetTest();
    location.hash = '#history';
  };
  document.querySelector('#snap-again').onclick = () => { state.capture = null; state.step = 2; test(); };
  document.querySelector('#again').onclick = () => { resetTest(); test(); };
}

function history() {
  const cards = state.records.length
    ? state.records.map((record) => {
      const type = waterType(record.ph);
      return `<article class="record" data-id="${escapeHtml(record.id)}"><div><strong>${escapeHtml(record.source || 'Saved test')}</strong><small>pH ${escapeHtml(record.ph)} · ${escapeHtml(formatDate(record.created))}</small></div><span class="swatch" style="background:${escapeHtml(record.color)}"></span><h2>${escapeHtml(type.title)}</h2><p>${escapeHtml(type.detail)}</p><button class="text-action" data-delete="${escapeHtml(record.id)}" type="button">Delete</button></article>`;
    }).join('')
    : '<p>No results saved yet.</p>';
  app.innerHTML = `${header('My results', 'Saved on this device.')}<div class="records">${cards}</div>${state.records.length ? '<button class="secondary" id="clear-all" type="button">Clear all results</button>' : ''}<a class="primary large" href="#test">Test my water</a>`;
  app.querySelectorAll('[data-delete]').forEach((button) => {
    button.onclick = () => {
      const id = button.getAttribute('data-delete');
      state.records = state.records.filter((record) => record.id !== id);
      commit();
      history();
      showToast('Result deleted.');
    };
  });
  document.querySelector('#clear-all')?.addEventListener('click', () => {
    if (!window.confirm('Delete all saved results on this device?')) return;
    state.records = [];
    commit();
    history();
    showToast('All results cleared.');
  });
  focusStep();
}

function learn() {
  app.innerHTML = `${header('Water science', 'Learn before you test.')}<section class="lesson"><span>Lesson 1</span><h2>The pH number line</h2><div class="scale"><div><b>1–6</b><strong>Acidic</strong></div><div><b>7</b><strong>Neutral</strong></div><div><b>8–14</b><strong>Alkaline</strong></div></div></section><section class="lesson"><span>Lesson 2</span><h2>What AquaCheck looks for</h2><p>pH 6.5–8.5 is within the drinking-water pH range. Values below this show higher acidity. Values above it show higher alkalinity.</p></section><section class="lesson"><span>Lesson 3</span><h2>Take a clear strip photo</h2><div class="tips"><p><b>Bright light</b><br>Keep shadows and glare away.</p><p><b>White paper</b><br>Use a plain background.</p><p><b>Sharp colour</b><br>Keep the coloured part inside the square.</p></div></section><section class="lesson"><span>Quick challenge</span><h2>Sort the pH values</h2><div class="quiz"><label>pH 4<select id="p4"><option value="">Choose</option><option value="acidic">Acidic</option><option value="neutral">Neutral</option><option value="alkaline">Alkaline</option></select></label><label>pH 7<select id="p7"><option value="">Choose</option><option value="acidic">Acidic</option><option value="neutral">Neutral</option><option value="alkaline">Alkaline</option></select></label><label>pH 10<select id="p10"><option value="">Choose</option><option value="acidic">Acidic</option><option value="neutral">Neutral</option><option value="alkaline">Alkaline</option></select></label></div><button class="primary" id="check">Check my answers</button><p id="feedback" role="status"></p></section>`;
  document.querySelector('#check').onclick = () => {
    const correct = document.querySelector('#p4').value === 'acidic' && document.querySelector('#p7').value === 'neutral' && document.querySelector('#p10').value === 'alkaline';
    document.querySelector('#feedback').textContent = correct ? 'Excellent! You sorted them all correctly.' : 'Try again: below 7 is acidic, 7 is neutral, and above 7 is alkaline.';
  };
  focusStep();
}

function imagePoint(media, image, point) {
  const boxWidth = media.clientWidth;
  const boxHeight = media.clientHeight;
  if (!boxWidth || !boxHeight || !image.width || !image.height) return point;
  const scale = Math.max(boxWidth / image.width, boxHeight / image.height);
  const offsetX = (image.width * scale - boxWidth) / 2;
  const offsetY = (image.height * scale - boxHeight) / 2;
  return {
    x: Math.min(0.999, Math.max(0, (point.x * boxWidth + offsetX) / (image.width * scale))),
    y: Math.min(0.999, Math.max(0, (point.y * boxHeight + offsetY) / (image.height * scale)))
  };
}

function bindTarget(box) {
  const target = box.querySelector('.target');
  const place = () => {
    target.style.left = `${(state.target.x - TARGET_SIZE / 2) * 100}%`;
    target.style.top = `${(state.target.y - TARGET_SIZE / 2) * 100}%`;
  };
  const moveTo = (clientX, clientY) => {
    const rect = box.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    state.target.x = clampTarget((clientX - rect.left) / rect.width);
    state.target.y = clampTarget((clientY - rect.top) / rect.height);
    place();
  };
  place();
  target.addEventListener('pointerdown', (event) => {
    target.setPointerCapture(event.pointerId);
    moveTo(event.clientX, event.clientY);
  });
  target.addEventListener('pointermove', (event) => {
    if (!target.hasPointerCapture?.(event.pointerId)) return;
    moveTo(event.clientX, event.clientY);
  });
  target.addEventListener('keydown', (event) => {
    const step = event.shiftKey ? 0.04 : 0.02;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    state.target.x = clampTarget(state.target.x + move[0]);
    state.target.y = clampTarget(state.target.y + move[1]);
    place();
  });
}

function route() {
  clearTimer();
  state.camera?.close();
  const page = location.hash.slice(1) || 'home';
  if (page === 'test' && lastPage !== 'test') resetTest();
  lastPage = page;
  document.querySelectorAll('nav a').forEach((link) => link.classList.toggle('active', link.getAttribute('href') === `#${page}`));
  ({ home, test, history, learn }[page] ?? home)();
}

window.addEventListener('hashchange', route);
window.addEventListener('pagehide', () => { clearTimer(); state.camera?.close(); });
route();
