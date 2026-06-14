// ── hot-zone geometry ────────────────────────────────────────
const HOT_ZONE_HALFWIDTH = 200;   // ~5 cm at 96 DPI; calibrate when mounted
const TRIGGER_Y = 1;              // cursor must hit the very top edge
const RAPID_HIT_MS = 2000;        // re-open within this window → meow2

// ── paw cursor tracking ──────────────────────────────────────
// Whole top band — the dropdown trigger (y≤1 inside pink x-strip) wins by
// virtue of opening a panel, which kills tracking. Outside the pink x-strip
// (e.g., near the corners), y can be 0 and we still want tracking there.
const TRACK_ZONE_Y_MIN  = 0;
const TRACK_ZONE_Y_MAX  = 25;
const TRACK_LINGER_MS   = 2500;   // hold in zone for this long → activate
// How far the cursor needs to be from screen center (in px) to map to the
// FULL paw extreme. ~ pink-halfwidth (200) + 2 cm (~78 at 96 DPI) ≈ 280.
// Cursor beyond this clamps to the extreme — no need to drag to the corners.
const TRACK_X_HALFRANGE = 280;
let currentDistState   = 0;       // mirror of firmware committed state
let trackingActive     = false;
let trackingLingerStart = 0;
let lastSentAngle      = -1;

// ── elements ─────────────────────────────────────────────────
const elDist     = document.getElementById('dist');
const elState    = document.getElementById('state');
const elApp      = document.getElementById('app');
const elMood     = document.getElementById('mood');
const elTrack    = document.getElementById('track');
const quitBtn    = document.getElementById('quit-btn');

quitBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  window.deebee.quitApp();
});

// ── HUD: mute-all + hide/show ───────────────────────────────
const muteAllBtn = document.getElementById('mute-all-btn');
const hideHudBtn = document.getElementById('hide-hud-btn');
const showHudBtn = document.getElementById('show-hud-btn');

function syncMuteAllBtn() {
  muteAllBtn.classList.toggle('muted', allMeowsMuted);
  muteAllBtn.title = allMeowsMuted ? 'Unmute all meows' : 'Mute all meows';
}

muteAllBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  allMeowsMuted = !allMeowsMuted;
  localStorage.setItem('deebee.allmuted', allMeowsMuted ? '1' : '0');
  syncMuteAllBtn();
});

const LS_HUD_HIDDEN = 'deebee.hud.hidden';
if (localStorage.getItem(LS_HUD_HIDDEN) === '1') document.body.classList.add('hud-hidden');

hideHudBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  document.body.classList.add('hud-hidden');
  localStorage.setItem(LS_HUD_HIDDEN, '1');
});
showHudBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  document.body.classList.remove('hud-hidden');
  localStorage.setItem(LS_HUD_HIDDEN, '0');
});
const elPomodoro = document.getElementById('hot-pomodoro');
const elNotes    = document.getElementById('hot-notes');

const notesPanel = document.getElementById('notes-panel');
const notesText  = document.getElementById('notes-text');
const notesMute  = document.getElementById('notes-mute');

const catBody    = document.getElementById('cat-body');
const catTail    = document.getElementById('cat-tail');

const pomoPanel  = document.getElementById('pomodoro-panel');
const pomoMute   = document.getElementById('pomodoro-mute');
const pomoTime   = document.getElementById('pomo-time');
const pomoPhase  = document.getElementById('pomo-phase');
const pomoStartBtn = document.getElementById('pomo-start');
const pomoResetBtn = document.getElementById('pomo-reset');
const pomoSkipBtn  = document.getElementById('pomo-skip');
const pomoWorkIn   = document.getElementById('pomo-work');
const pomoShortIn  = document.getElementById('pomo-short');
const pomoLongIn   = document.getElementById('pomo-long');

// ── audio (Web Audio API for sub-millisecond playback) ───────
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const gain = audioCtx.createGain();
gain.gain.value = 0.85;
gain.connect(audioCtx.destination);

const buffers = {};
async function loadSound(name, url) {
  const res = await fetch(url);
  const arr = await res.arrayBuffer();
  buffers[name] = await audioCtx.decodeAudioData(arr);
}
loadSound('meow1', '../../Audio/meow1.m4a');
loadSound('meow2', '../../Audio/meow2.m4a');
loadSound('meow3', '../../Audio/meow3.mp3');   // "bored" mood
loadSound('meow4', '../../Audio/meow4.mp3');   // "too close" warning
loadSound('happy', '../../Audio/Happy-meow.mp3'); // happy-mood paw raise

let allMeowsMuted = localStorage.getItem('deebee.allmuted') === '1';
syncMuteAllBtn();   // reflect persisted state on the HUD icon

function play(name, volume = 1.0) {
  if (allMeowsMuted) return;
  const buf = buffers[name];
  if (!buf) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  if (volume !== 1.0) {
    const g = audioCtx.createGain();
    g.gain.value = volume;
    src.connect(g);
    g.connect(gain);
  } else {
    src.connect(gain);
  }
  src.start(0);
}

// ── persistence keys ─────────────────────────────────────────
const LS_NOTES_TEXT  = 'deebee.notes.text';
const LS_NOTES_MUTED = 'deebee.notes.muted';
const LS_POMO_MUTED  = 'deebee.pomo.muted';
const LS_POMO_WORK   = 'deebee.pomo.work';
const LS_POMO_SHORT  = 'deebee.pomo.short';
const LS_POMO_LONG   = 'deebee.pomo.long';

// ── notes content + mute persistence ─────────────────────────
notesText.value = localStorage.getItem(LS_NOTES_TEXT) || '';
notesText.addEventListener('input', () => {
  localStorage.setItem(LS_NOTES_TEXT, notesText.value);
});

let notesMuted = localStorage.getItem(LS_NOTES_MUTED) === '1';
function syncNotesMuteUI() { notesMute.classList.toggle('muted', notesMuted); }
syncNotesMuteUI();
notesMute.addEventListener('click', (e) => {
  e.stopPropagation();
  notesMuted = !notesMuted;
  localStorage.setItem(LS_NOTES_MUTED, notesMuted ? '1' : '0');
  syncNotesMuteUI();
});

// ── pomodoro settings + mute persistence ─────────────────────
let pomoMuted = localStorage.getItem(LS_POMO_MUTED) === '1';
function syncPomoMuteUI() { pomoMute.classList.toggle('muted', pomoMuted); }
syncPomoMuteUI();
pomoMute.addEventListener('click', (e) => {
  e.stopPropagation();
  pomoMuted = !pomoMuted;
  localStorage.setItem(LS_POMO_MUTED, pomoMuted ? '1' : '0');
  syncPomoMuteUI();
});

pomoWorkIn.value  = parseInt(localStorage.getItem(LS_POMO_WORK))  || 25;
pomoShortIn.value = parseInt(localStorage.getItem(LS_POMO_SHORT)) || 5;
pomoLongIn.value  = parseInt(localStorage.getItem(LS_POMO_LONG))  || 15;

const SETTING_INPUTS = [
  [pomoWorkIn,  LS_POMO_WORK,  'work'],
  [pomoShortIn, LS_POMO_SHORT, 'short'],
  [pomoLongIn,  LS_POMO_LONG,  'long'],
];
SETTING_INPUTS.forEach(([input, key, phaseName]) => {
  input.addEventListener('input', () => {
    const v = Math.max(1, parseInt(input.value) || 1);
    localStorage.setItem(key, String(v));
    // If we're idle in this phase, snap the displayed time to the new duration.
    if (!pomoRunning && pomoPhase_ === phaseName) {
      pomoSeconds = v * 60;
      renderPomo();
    }
  });
});

// ── pomodoro timer state ─────────────────────────────────────
let pomoPhase_  = 'work';                       // 'work' | 'short' | 'long'
let pomoSeconds = parseInt(pomoWorkIn.value) * 60;
let pomoRunning = false;
let pomoTickId  = null;
let pomoWorkCount = 0;
const LONG_BREAK_EVERY = 4;

function phaseSeconds(p) {
  const m = p === 'work'  ? parseInt(pomoWorkIn.value)
          : p === 'short' ? parseInt(pomoShortIn.value)
          :                 parseInt(pomoLongIn.value);
  return Math.max(1, m) * 60;
}

function renderPomo() {
  const m = Math.floor(pomoSeconds / 60);
  const s = pomoSeconds % 60;
  pomoTime.textContent =
    `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  pomoPhase.textContent =
    pomoPhase_ === 'work'  ? 'work' :
    pomoPhase_ === 'short' ? 'short break' : 'long break';
  pomoStartBtn.textContent = pomoRunning ? 'PAUSE' : 'START';
}

function startPomo() {
  if (pomoRunning) return;
  pomoRunning = true;
  pomoTickId = setInterval(() => {
    pomoSeconds--;
    if (pomoSeconds <= 0) advancePomoPhase();
    renderPomo();
  }, 1000);
  renderPomo();
}
function pausePomo() {
  pomoRunning = false;
  if (pomoTickId) { clearInterval(pomoTickId); pomoTickId = null; }
  renderPomo();
}
function resetPomo() {
  pausePomo();
  pomoSeconds = phaseSeconds(pomoPhase_);
  renderPomo();
}
function advancePomoPhase() {
  if (pomoPhase_ === 'work') {
    pomoWorkCount++;
    pomoPhase_ = (pomoWorkCount % LONG_BREAK_EVERY === 0) ? 'long' : 'short';
    showCatBody();
  } else {
    pomoPhase_ = 'work';
    hideCatBody();
  }
  pomoSeconds = phaseSeconds(pomoPhase_);
}
function skipPomo() { advancePomoPhase(); renderPomo(); }

// ── cat body drop + tail tickle ──────────────────────────────
const TAIL_BREAK_COUNT = 3;
const TAIL_RESET_MS = 2000;
let tailClicks = 0;
let tailResetTimer = null;

function showCatBody() { catBody.classList.add('dropped'); }
function hideCatBody() { catBody.classList.remove('dropped'); }

function breakRest() {
  hideCatBody();
  pomoPhase_ = 'work';
  pomoSeconds = phaseSeconds('work');
  renderPomo();
}

catTail.addEventListener('click', (e) => {
  e.stopPropagation();
  catTail.classList.remove('bounce');
  void catTail.offsetWidth;      // restart animation if already running
  catTail.classList.add('bounce');
  tailClicks++;
  if (tailResetTimer) clearTimeout(tailResetTimer);
  tailResetTimer = setTimeout(() => { tailClicks = 0; }, TAIL_RESET_MS);
  if (tailClicks >= TAIL_BREAK_COUNT) {
    tailClicks = 0;
    clearTimeout(tailResetTimer);
    play('meow2');               // placeholder annoyed-meow until you add one
    breakRest();
  }
});
catTail.addEventListener('animationend', () => catTail.classList.remove('bounce'));

pomoStartBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  pomoRunning ? pausePomo() : startPomo();
});
pomoResetBtn.addEventListener('click', (e) => { e.stopPropagation(); resetPomo(); });
pomoSkipBtn.addEventListener('click',  (e) => { e.stopPropagation(); skipPomo(); });
renderPomo();

// ── hot-zone layout ──────────────────────────────────────────
function layoutHotZones() {
  const cx = window.innerWidth / 2;
  elPomodoro.style.left  = (cx - HOT_ZONE_HALFWIDTH) + 'px';
  elPomodoro.style.width = HOT_ZONE_HALFWIDTH + 'px';
  elNotes.style.left  = cx + 'px';
  elNotes.style.width = HOT_ZONE_HALFWIDTH + 'px';
}
layoutHotZones();
window.addEventListener('resize', layoutHotZones);

// ── panel open / close ───────────────────────────────────────
let notesOpen = false;
let pomoOpen  = false;
let lastOpenAt = 0;               // shared across both panels — same cat

function syncFocusable() {
  window.deebee.setFocusable(notesOpen || pomoOpen);
}

// Tell the firmware which paws should be HELD DOWN to match the open
// dropdown(s). servo1 = right paw (notes), servo2 = left paw (pomodoro).
function syncPawHold() {
  let mask = 0;
  if (notesOpen) mask |= 1;     // bit 0 → right paw down
  if (pomoOpen)  mask |= 2;     // bit 1 → left paw down
  window.deebee.toEsp('H:' + mask);
}

function openNotes() {
  if (notesOpen) return;
  notesOpen = true;
  notesPanel.classList.add('open');
  syncFocusable();
  syncPawHold();
  const now = Date.now();
  const rapid = (now - lastOpenAt) < RAPID_HIT_MS;
  lastOpenAt = now;
  if (!notesMuted) play(rapid ? 'meow2' : 'meow1');
}
function closeNotes() {
  if (!notesOpen) return;
  notesOpen = false;
  notesPanel.classList.remove('open');
  notesText.blur();
  syncFocusable();
  syncPawHold();
}

function openPomo() {
  if (pomoOpen) return;
  pomoOpen = true;
  pomoPanel.classList.add('open');
  syncFocusable();
  syncPawHold();
  const now = Date.now();
  const rapid = (now - lastOpenAt) < RAPID_HIT_MS;
  lastOpenAt = now;
  if (!pomoMuted) play(rapid ? 'meow2' : 'meow1');
}
function closePomo() {
  if (!pomoOpen) return;
  pomoOpen = false;
  pomoPanel.classList.remove('open');
  syncFocusable();
  syncPawHold();
}

function rectOf(el) { return el.getBoundingClientRect(); }
function inside(x, y, r) {
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

// ── interactivity (click-through) toggle ─────────────────────
let interactive = false;
function setInteractive(v) {
  if (v === interactive) return;
  interactive = v;
  window.deebee.setInteractive(v);
}

window.deebee.onCursor(({ x, y }) => {
  const cx = window.innerWidth / 2;
  const hitTop = y <= TRIGGER_Y;
  const inRightStrip = hitTop && x >= cx && x <= cx + HOT_ZONE_HALFWIDTH;
  const inLeftStrip  = hitTop && x >= cx - HOT_ZONE_HALFWIDTH && x < cx;

  if (inRightStrip && !notesOpen) openNotes();
  if (inLeftStrip  && !pomoOpen)  openPomo();

  if (notesOpen) {
    const over = inside(x, y, rectOf(notesPanel));
    if (!over && !inRightStrip) closeNotes();
  }
  if (pomoOpen) {
    const over = inside(x, y, rectOf(pomoPanel));
    if (!over && !inLeftStrip) closePomo();
  }

  const overNotes = notesOpen && inside(x, y, rectOf(notesPanel));
  const overPomo  = pomoOpen  && inside(x, y, rectOf(pomoPanel));
  const overTail  = catBody.classList.contains('dropped') &&
                    inside(x, y, rectOf(catTail));
  const hudHidden = document.body.classList.contains('hud-hidden');
  const overHudControls = !hudHidden && inside(x, y, rectOf(document.querySelector('.hud-controls')));
  const overShowHud     = hudHidden  && inside(x, y, rectOf(showHudBtn));
  setInteractive(
    inRightStrip || inLeftStrip || overNotes || overPomo || overTail ||
    overHudControls || overShowHud
  );

  updateTracking(x, y);
});

// ── cursor → paw tracking ────────────────────────────────────
// Safety heartbeat — resends the last known angle every 500ms while tracking
// is active. Backstop in case cursor polling skips a beat during focus events.
let trackingHeartbeatId = null;
function startTrackingHeartbeat() {
  if (trackingHeartbeatId) return;
  trackingHeartbeatId = setInterval(() => {
    if (trackingActive && lastSentAngle >= 0) {
      window.deebee.toEsp('T:' + lastSentAngle);
    }
  }, 500);
}
function stopTrackingHeartbeat() {
  if (trackingHeartbeatId) {
    clearInterval(trackingHeartbeatId);
    trackingHeartbeatId = null;
  }
}

function stopTracking() {
  if (!trackingActive) return;
  trackingActive = false;
  lastSentAngle = -1;
  window.deebee.toEsp('R');         // tell firmware to release tracking
  stopTrackingHeartbeat();
  if (elTrack) elTrack.textContent = 'off';
}

function updateTracking(x, y) {
  // Don't track while a dropdown is open — user is interacting with the panel.
  if (notesOpen || pomoOpen) {
    stopTracking();
    trackingLingerStart = 0;
    return;
  }
  // Distance alarm wins. Reset linger so user has to hold cursor again.
  if (currentDistState >= 1) {
    stopTracking();
    trackingLingerStart = 0;
    return;
  }

  const cx = window.innerWidth / 2;
  const inZoneY = y >= TRACK_ZONE_Y_MIN && y <= TRACK_ZONE_Y_MAX;
  const inZoneX = Math.abs(x - cx) <= TRACK_X_HALFRANGE;
  if (!inZoneY || !inZoneX) {
    stopTracking();
    trackingLingerStart = 0;
    return;
  }

  if (trackingLingerStart === 0) trackingLingerStart = Date.now();

  if (!trackingActive) {
    const remaining = TRACK_LINGER_MS - (Date.now() - trackingLingerStart);
    if (elTrack) elTrack.textContent = 'lingering ' + Math.max(0, Math.ceil(remaining / 1000)) + 's';
    if (remaining <= 0) {
      trackingActive = true;
      startTrackingHeartbeat();
      if (elTrack) elTrack.textContent = 'ON';
    }
  }

  if (trackingActive) {
    // Send every poll (~50ms) so the firmware's tracking-timeout never trips
    // when the cursor is held still.
    // Cursor X is within ±TRACK_X_HALFRANGE here (gated by inZoneX above).
    const angle = Math.round(90 + ((x - cx) / TRACK_X_HALFRANGE) * 90);
    window.deebee.toEsp('T:' + angle);
    lastSentAngle = angle;
  }
}

document.addEventListener('mousedown', (e) => {
  if (notesOpen && !notesPanel.contains(e.target)) closeNotes();
  if (pomoOpen  && !pomoPanel.contains(e.target))  closePomo();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (notesOpen) closeNotes();
    if (pomoOpen)  closePomo();
  }
});

// ── active-window mood meows ─────────────────────────────────
// Rules are checked top-to-bottom; first match wins.
const MOOD_RULES = [
  { name: 'bored',   test: w => /(youtube|tiktok|instagram|reddit|netflix|twitch|twitter|facebook)/i.test(w.title) },
  { name: 'happy',   test: w => /(figma|photoshop|illustrator|premiere|after\s*effects|blender|procreate|krita)/i.test(w.owner + ' ' + w.title) },
  { name: 'focused', test: w => /(code|sublime|cursor|pycharm|webstorm|visual\s*studio|arduino|terminal|powershell|wezterm)/i.test(w.owner) },
];

// Mood → which sound to play on entry. null = silent.
// Happy is silent on entry — the cat reacts after 10 s with the raise + Happy-meow.
const MOOD_SOUNDS = {
  happy:   null,
  bored:   'meow3',
  focused: null,
};

let lastMood = null;
let happyTimer = null;
const HAPPY_RAISE_DELAY_MS    = 10000;  // be happy this long before paws raise
const HAPPY_RAISE_DURATION_MS = 3000;   // raised for this long, then back

window.deebee.onActiveWindow(info => {
  elApp.textContent = (info.owner || info.title || '—').slice(0, 32);
  const rule = MOOD_RULES.find(r => r.test(info));
  const mood = rule ? rule.name : 'neutral';
  elMood.textContent = mood;
  elMood.style.opacity = mood === 'neutral' ? 0.4 : 1;
  if (mood === lastMood) return;       // only fire on transitions
  lastMood = mood;
  const sound = MOOD_SOUNDS[mood];
  if (sound) play(sound);

  // Happy mood ≥ 10s → raise paws for 3s, single fire per streak.
  // Cancelled if mood changes before the 10s elapses.
  if (mood === 'happy') {
    if (happyTimer) clearTimeout(happyTimer);
    happyTimer = setTimeout(() => {
      window.deebee.toEsp(`R:${HAPPY_RAISE_DURATION_MS}`);
      play('happy', 0.5);
      happyTimer = null;
    }, HAPPY_RAISE_DELAY_MS);
  } else if (happyTimer) {
    clearTimeout(happyTimer);
    happyTimer = null;
  }
});

// ── live readout from the ESP32 ──────────────────────────────
window.deebee.onSerial(line => {
  if (line.startsWith('D:')) {
    elDist.textContent = line.slice(2) + ' cm';
  } else if (line.startsWith('S:')) {
    const newState = parseInt(line.slice(2));
    // Entering alarm → kill any active tracking + reset linger counter.
    if (newState >= 1 && currentDistState === 0) {
      stopTracking();
      trackingLingerStart = 0;
    }
    currentDistState = newState;
    elState.textContent =
      newState === 0 ? 'fine' :
      newState === 1 ? 'close' :
      newState === 2 ? 'too close' : String(newState);
    if (newState === 2) play('meow4');
  }
});
