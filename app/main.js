const { app, BrowserWindow, screen, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

// Allow Web Audio to start without a user gesture (transparent overlay can't
// reliably receive a "first interaction" the way a normal page does).
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const ESP32_VID = '303a';            // Espressif (sometimes hidden by Windows)
const PROBE_TIMEOUT_MS = 1500;
const RECONNECT_INTERVAL_MS = 5000;
const ACTIVE_WIN_POLL_MS = 1500;     // foreground-app detection

let mainWindow;
let serialPort;
let connecting = false;
let knownPortPath = null;            // remembered once discovered

function probePort(portPath) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      try { port.close(() => {}); } catch (_) {}
      resolve(ok);
    };
    let port;
    try {
      port = new SerialPort({ path: portPath, baudRate: 115200, autoOpen: false });
    } catch (_) {
      return resolve(false);
    }
    const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));
    port.on('error', () => finish(false));
    parser.on('data', line => {
      // Our firmware sends "D:<cm>" — anything else means it's not us.
      if (line.trim().startsWith('D:')) finish(true);
    });
    port.open(err => {
      if (err) return finish(false);
      setTimeout(() => finish(false), PROBE_TIMEOUT_MS);
    });
  });
}

async function findEspPort() {
  const ports = await SerialPort.list();
  console.log('[serial] candidates:',
    ports.map(p => ({ path: p.path, vid: p.vendorId, mfr: p.manufacturer })));

  // 1) VID/manufacturer match (works on Mac, sometimes on Windows)
  const tagged = ports.find(p =>
    (p.vendorId && p.vendorId.toLowerCase() === ESP32_VID) ||
    (p.manufacturer && /espressif/i.test(p.manufacturer))
  );
  if (tagged) {
    console.log('[serial] tagged ESP32 at', tagged.path);
    return tagged.path;
  }

  // 2) Try the remembered port first to skip re-probing every reconnect.
  const ordered = knownPortPath
    ? [knownPortPath, ...ports.map(p => p.path).filter(p => p !== knownPortPath)]
    : ports.map(p => p.path);

  for (const candidate of ordered) {
    process.stdout.write(`[serial] probing ${candidate}... `);
    const ok = await probePort(candidate);
    console.log(ok ? 'MATCH' : 'no');
    if (ok) return candidate;
  }
  return null;
}

async function openSerial() {
  if (connecting) return;
  if (serialPort && serialPort.isOpen) return;
  connecting = true;
  try {
    const portPath = await findEspPort();
    if (!portPath) {
      console.log('[serial] ESP32 not found, will retry...');
      return;
    }
    knownPortPath = portPath;
    serialPort = new SerialPort({ path: portPath, baudRate: 115200 });
    const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));

    parser.on('data', line => {
      line = line.trim();
      console.log('[serial] <', line);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('serial-data', line);
      }
    });

    serialPort.on('error', err => console.error('[serial]', err.message));
    serialPort.on('close', () => {
      console.log('[serial] port closed');
      serialPort = null;
    });
    console.log('[serial] connected on', portPath);
  } finally {
    connecting = false;
  }
}

function sendToEsp(line) {
  if (serialPort && serialPort.isOpen) serialPort.write(line + '\n');
}

function createOverlay() {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.bounds;

  mainWindow = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width,
    height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setIgnoreMouseEvents(true, { forward: true });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'overlay.html'));

  setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const point = screen.getCursorScreenPoint();
    const b = mainWindow.getBounds();
    mainWindow.webContents.send('cursor-position', {
      x: point.x - b.x,
      y: point.y - b.y,
    });
  }, 50);
}

ipcMain.on('set-interactive', (_evt, interactive) => {
  if (!mainWindow) return;
  if (interactive) mainWindow.setIgnoreMouseEvents(false);
  else mainWindow.setIgnoreMouseEvents(true, { forward: true });
});

ipcMain.on('to-esp', (_evt, line) => sendToEsp(line));

ipcMain.on('set-focusable', (_evt, val) => {
  if (mainWindow) mainWindow.setFocusable(!!val);
});

ipcMain.on('quit-app', () => app.quit());

app.on('before-quit', () => {
  try {
    if (serialPort && serialPort.isOpen) serialPort.close();
  } catch (_) {}
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// ── active-window polling (ESM module — load via dynamic import) ─
let activeWinFn = null;
let lastWinKey = '';
async function setupActiveWin() {
  try {
    const mod = await import('active-win');
    activeWinFn = mod.default;
    console.log('[active-win] ready');
  } catch (e) {
    console.error('[active-win] load failed:', e.message);
  }
}
async function pollActiveWindow() {
  if (!activeWinFn || !mainWindow || mainWindow.isDestroyed()) return;
  try {
    const info = await activeWinFn();
    if (!info) return;
    const owner = info.owner ? info.owner.name : '';
    const title = info.title || '';
    const key = owner + '||' + title;
    if (key === lastWinKey) return;
    lastWinKey = key;
    mainWindow.webContents.send('active-window', { owner, title });
  } catch (_) { /* swallow — active-win occasionally throws on transient errors */ }
}

app.whenReady().then(async () => {
  createOverlay();
  openSerial();
  setInterval(openSerial, RECONNECT_INTERVAL_MS);
  await setupActiveWin();
  setInterval(pollActiveWindow, ACTIVE_WIN_POLL_MS);

  // Re-assert always-on-top periodically: Windows demotes the level after
  // focus events (USB hotplug, fullscreen apps, etc).
  setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
      mainWindow.moveTop();
    }
  }, 3000);

  // Global hotkey to quit the app from anywhere on the system.
  globalShortcut.register('CommandOrControl+Shift+Q', () => {
    console.log('[exit] hotkey received');
    app.quit();
  });
});

app.on('window-all-closed', () => app.quit());
