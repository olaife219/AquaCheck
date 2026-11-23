import { stripProfile } from './profile.js';
import { loadRecords, saveRecords } from './storage.js';
import { samplePatch, classifyColour, waterType } from './colour.js';
import { StripCamera } from './camera.js';

const app = document.querySelector('#app');
const toast = document.querySelector('#toast');
const state = { records: loadRecords(), step: 0, capture: null, target: { x: 0.5, y: 0.5 }, camera: null };

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const formatDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const showToast = (message) => { toast.textContent = message; toast.hidden = false; setTimeout(() => { toast.hidden = true; }, 3600); };
const commit = () => saveRecords(state.records) || showToast('This device could not save your result.');
const progress = () => `<div class="progress" aria-label="Step ${state.step + 1} of 4">${[0, 1, 2, 3].map((index) => `<span class="${index <= state.step ? 'done' : ''}"></span>`).join('')}</div>`;

function header(title, description = '') {
  return `<div class="page-head"><div><span class="eyebrow">AquaCheck</span><h1>${title}</h1><p>${description}</p></div></div>`;
}

function resultView(record) {
  const type = waterType(record.ph);
  return `<div class="result-number">${record.ph}<small>estimated pH</small></div><div class="result-colour"><span style="background:${record.color}" aria-label="Colour read from your strip"></span><small>Colour read from your strip</small></div><section class="result-status ${type.tone}"><h2>${type.title}</h2><p>${type.detail}</p></section><p class="single-note">A normal pH does not automatically mean the water is safe to drink.</p>`;
}

function home() {
  app.innerHTML = `${header('Snap your strip. Discover the pH.', 'Take a clear photo and AquaCheck reads the strip colour.')}<a class="primary large" href="#test">Test my water</a><div class="home-links"><a href="#history">My results<small>See saved tests</small></a><a href="#learn">Learn<small>Explore pH science</small></a></div>`;
}

function test() {
  state.camera?.close();
  app.innerHTML = `<a class="back" href="#home">Home</a><main class="test-card">${progress()}<div id="step-content"></div></main>`;
  const content = document.querySelector('#step-content');
  if (state.step === 0) {
    content.innerHTML = `<h1>Get your strip ready.</h1><ol class="steps"><li>Pour water into a clean cup.</li><li>Take out one pH strip.</li><li>Find a bright place without glare.</li></ol><button class="primary large" id="continue">I’m ready</button>`;
    document.querySelector('#continue').onclick = () => { state.step = 1; test(); };
  } else if (state.step === 1) {
    content.innerHTML = `<h1>Dip. Then wait.</h1><p>Follow the time shown on your strip pack.</p><label>Wait time in seconds<input id="wait" type="number" value="30" min="1" max="600"></label><div class="timer" id="timer">30s</div><button class="primary large" id="start-timer">Start waiting</button><button class="primary large" id="next" hidden>Snap my strip</button>`;
    document.querySelector('#start-timer').onclick = () => {
      let seconds = Number(document.querySelector('#wait').value);
      if (!Number.isInteger(seconds) || seconds < 1 || seconds > 600) return showToast('Enter a time from 1 to 600 seconds.');
      document.querySelector('#start-timer').disabled = true;
      const timer = setInterval(() => { seconds--; document.querySelector('#timer').textContent = `${seconds}s`; if (seconds <= 0) { clearInterval(timer); document.querySelector('#next').hidden = false; } }, 1000);
    };
    document.querySelector('#next').onclick = () => { state.step = 2; test(); };
  } else if (state.step === 2) {
    cameraStep(content);
  } else {
    resultStep(content);
  }
}

async function cameraStep(content) {
  content.innerHTML = `<h1>Snap your strip.</h1><p>Place the strip on white paper. Keep the coloured part inside the square.</p><div class="camera-box"><video id="camera" autoplay muted playsinline></video><span class="target"></span></div><button class="primary large" id="snap" disabled>Snap</button><p id="camera-message" role="status">Opening your camera…</p>`;
  const video = document.querySelector('#camera');
  state.camera = new StripCamera(video);
  try {
    await state.camera.open();
    document.querySelector('#snap').disabled = false;
    document.querySelector('#camera-message').textContent = 'Hold the strip still, then press Snap.';
  } catch {
    document.querySelector('#camera-message').textContent = 'Camera access is blocked. Allow camera access in your browser settings, then try again.';
  }
  document.querySelector('#snap').onclick = () => {
    try {
      const capture = state.camera.capture();
      const patch = samplePatch(capture.image, state.target);
      if (patch.error) return showToast(patch.error);
      const result = classifyColour(patch.rgb, stripProfile);
      if (result.error) return showToast(result.error);
      state.capture = result;
      state.step = 3;
      test();
    } catch (error) { showToast(error.message); }
  };
}

function resultStep(content) {
  const record = { ph: state.capture.ph, color: state.capture.color };
  content.innerHTML = `<div class="center"><span class="eyebrow">Your water result</span><h1>Here’s what your strip shows.</h1>${resultView(record)}<button class="primary large" id="save">Save my result</button><button class="secondary" id="again">Test again</button></div>`;
  document.querySelector('#save').onclick = () => {
    state.records.unshift({ id: crypto.randomUUID(), created: new Date().toISOString(), ...record });
    commit(); location.hash = '#history';
  };
  document.querySelector('#again').onclick = () => { state.step = 1; state.capture = null; test(); };
}

function history() {
  const cards = state.records.length ? state.records.map((record) => { const type = waterType(record.ph); return `<article class="record"><div><strong>pH ${record.ph}</strong><small>${formatDate(record.created)}</small></div><span class="swatch" style="background:${record.color}"></span><h2>${type.title}</h2><p>${type.detail}</p></article>`; }).join('') : '<p>No results saved yet.</p>';
  app.innerHTML = `${header('My results', 'Saved on this device.')}<div class="records">${cards}</div><a class="primary large" href="#test">Test my water</a>`;
}

function learn() {
  app.innerHTML = `${header('Water science', 'Learn before you test.')}<section class="lesson"><span>Lesson 1</span><h2>The pH number line</h2><div class="scale"><div><b>1–6</b><strong>Acidic</strong></div><div><b>7</b><strong>Neutral</strong></div><div><b>8–14</b><strong>Alkaline</strong></div></div></section><section class="lesson"><span>Lesson 2</span><h2>What AquaCheck looks for</h2><p>pH 6.5–8.5 is within the drinking-water pH range. Values below this show higher acidity. Values above it show higher alkalinity.</p></section><section class="lesson"><span>Lesson 3</span><h2>Take a clear strip photo</h2><div class="tips"><p><b>Bright light</b><br>Keep shadows and glare away.</p><p><b>White paper</b><br>Use a plain background.</p><p><b>Sharp colour</b><br>Keep the coloured part inside the square.</p></div></section><section class="lesson"><span>Quick challenge</span><h2>Sort the pH values</h2><div class="quiz"><label>pH 4<select id="p4"><option value="">Choose</option><option value="acidic">Acidic</option><option value="neutral">Neutral</option><option value="alkaline">Alkaline</option></select></label><label>pH 7<select id="p7"><option value="">Choose</option><option value="acidic">Acidic</option><option value="neutral">Neutral</option><option value="alkaline">Alkaline</option></select></label><label>pH 10<select id="p10"><option value="">Choose</option><option value="acidic">Acidic</option><option value="neutral">Neutral</option><option value="alkaline">Alkaline</option></select></label></div><button class="primary" id="check">Check my answers</button><p id="feedback" role="status"></p></section>`;
  document.querySelector('#check').onclick = () => { const correct = document.querySelector('#p4').value === 'acidic' && document.querySelector('#p7').value === 'neutral' && document.querySelector('#p10').value === 'alkaline'; document.querySelector('#feedback').textContent = correct ? 'Excellent! You sorted them all correctly.' : 'Try again: below 7 is acidic, 7 is neutral, and above 7 is alkaline.'; };
}

function route() {
  state.camera?.close();
  const page = location.hash.slice(1) || 'home';
  document.querySelectorAll('nav a').forEach((link) => link.classList.toggle('active', link.getAttribute('href') === `#${page}`));
  ({ home, test, history, learn }[page] ?? home)();
}

window.addEventListener('hashchange', route);
window.addEventListener('pagehide', () => state.camera?.close());
route();
