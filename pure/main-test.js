const { app, BrowserWindow } = require('electron');
const path = require('path');

console.log('✅ Electron loaded successfully');
console.log('app:', typeof app);
console.log('BrowserWindow:', typeof BrowserWindow);

app.whenReady().then(() => {
  console.log('✅ App is ready!');

  const win = new BrowserWindow({
    width: 800,
    height: 600
  });

  win.loadFile(path.join(__dirname, '..', 'Caja', 'panel.html'));

  console.log('✅ Window created!');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
