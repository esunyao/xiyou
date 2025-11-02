'use strict';

const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const TARGET_URL = 'https://student.xiyouyingyu.com/';

let mainWindow = null;

function createMainWindow() {
	mainWindow = new BrowserWindow({
		width: 1200,
		height: 800,
		webPreferences: {
			preload: path.join(__dirname, 'preload.js'),
			contextIsolation: true,
			nodeIntegration: false,
			spellcheck: false,
			sandbox: true,
		}
	});

	mainWindow.loadURL(TARGET_URL);

	mainWindow.webContents.setWindowOpenHandler(({ url }) => {
		// Open external links in default browser
		if (!url.startsWith(TARGET_URL)) {
			shell.openExternal(url);
			return { action: 'deny' };
		}
		return { action: 'allow' };
	});

	mainWindow.on('closed', () => {
		mainWindow = null;
	});

	setupMenu();
	setupIPC();
}

function setupIPC() {
	// IPC handler to read injection files (for sandbox mode)
	ipcMain.handle('read-injection-file', async (event, filename) => {
		try {
			const userDir = path.join(process.cwd(), 'user');
			const filePath = path.join(userDir, filename);
			if (fs.existsSync(filePath)) {
				return fs.readFileSync(filePath, 'utf8');
			}
			return '';
		} catch (error) {
			console.error('Error reading injection file:', error);
			return '';
		}
	});
}

function setupMenu() {
	const isMac = process.platform === 'darwin';
	const template = [
		...(isMac ? [{ role: 'appMenu' }] : []),
		{
			label: 'View',
			submenu: [
				{ role: 'reload', accelerator: 'Ctrl+R' },
				{ role: 'forceReload', accelerator: 'Ctrl+Shift+R' },
				{ type: 'separator' },
				{ role: 'toggleDevTools', accelerator: 'Ctrl+Shift+I' },
			]
		},
		{
			label: 'Injection',
			submenu: [
				{
					label: 'Re-run Injection Now',
					accelerator: 'Ctrl+Shift+J',
					click: () => {
						if (mainWindow) {
							mainWindow.webContents.send('injection:run');
						}
					}
				},
			]
		},
		{ role: 'windowMenu' },
	];
	const menu = Menu.buildFromTemplate(template);
	Menu.setApplicationMenu(menu);
}

app.on('ready', createMainWindow);

app.on('activate', () => {
	if (mainWindow === null) createMainWindow();
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit();
});


