const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('deebee', {
  onSerial: (cb) => ipcRenderer.on('serial-data', (_, line) => cb(line)),
  onCursor: (cb) => ipcRenderer.on('cursor-position', (_, pos) => cb(pos)),
  onActiveWindow: (cb) => ipcRenderer.on('active-window', (_, info) => cb(info)),
  setInteractive: (val) => ipcRenderer.send('set-interactive', val),
  setFocusable: (val) => ipcRenderer.send('set-focusable', val),
  toEsp: (line) => ipcRenderer.send('to-esp', line),
  quitApp: () => ipcRenderer.send('quit-app'),
});
