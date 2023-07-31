const { app, BrowserWindow, clipboard, Menu, nativeTheme, dialog, ipcMain, Notification, shell } = require('electron')
const fs = require('fs')
const os = require('os')
const path = require('path')

const sintel = 'magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel&tr=udp%3A%2F%2Fexplodie.org%3A6969&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969&tr=udp%3A%2F%2Ftracker.empire-js.us%3A1337&tr=udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.fastcast.nz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com&ws=https%3A%2F%2Fwebtorrent.io%2Ftorrents%2F&xs=https%3A%2F%2Fwebtorrent.io%2Ftorrents%2Fsintel.torrent'
const sampleItems = [sintel]

let webTorrentClient
let downloadPath
let mainWindow
let interval
let deepLinkUrl
let settings

if (app.requestSingleInstanceLock()) {
    app.on('second-instance', (e, argv, workingDir, data) => {
        let url = argv.pop()
        if (app.isReady() && webTorrentClient && url) {
            webTorrentClient.add(url, { path: downloadPath })
        } else {
            deepLinkUrl = url
        }
    })
}

app.whenReady().then(() => importWebTorrent(app)).then((WebTorrent) => {
    webTorrentClient = new WebTorrent.default()
    webTorrentClient.on('torrent', onTorrent)
    webTorrentClient.on('error', onError)
    if (fs.existsSync(path.join(app.getPath('userData'), 'Settings.json'))) {
        settings = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'Settings.json')))
    } else {
        settings = {
            'download_path': path.join(app.getPath('downloads'), 'MagTorrent'),
            'torrent_done_notification': 'silent',
            'torrent_done_sound': true,
        }
    }
    downloadPath = settings['download_path']
    if (fs.existsSync(downloadPath) === false) {
        fs.mkdirSync(downloadPath)
    }
    if (fs.existsSync(path.join(app.getPath('userData'), 'History.json'))) {
        let torrentJson = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'History.json')))
        let joinPath = path.join
        torrentJson.forEach(({ magnetURI, name, path, paused }) => {
            let torrent = webTorrentClient.add(magnetURI, { path: path }, (torrent) => {
                torrent.source = 'history'
                if (paused) torrent.pause()
            })
            if (fs.existsSync(joinPath(path, name)) === false) {
                torrent.error = '123'
                torrent.pause()
            }
        })
        if (deepLinkUrl) {
            webTorrentClient.add(deepLinkUrl, { path: downloadPath })
            deepLinkUrl = undefined
        }
    }
    createAppMenu()
    createMainWindow()
    if (app.isDefaultProtocolClient('magnet')) {
        app.setAsDefaultProtocolClient('magnet')
    }
})

app.on('open-url', (e, url) => {
    if (app.isReady()) {
        webTorrentClient.add(url, { path: downloadPath })
    } else {
        deepLinkUrl = url
    }
})

app.on('window-all-closed', () => {
    finish()
})

ipcMain.on('add-torrent', (e, magnetURI) => {
    webTorrentClient.add(magnetURI, { path: downloadPath })
    mainWindow.webContents.send('adding-torrent')
})

ipcMain.on('show-app-options', (e, point) => {
    createAppOptionsMenu(point)
})

ipcMain.on('show-torrent-options', (e, torrent, point) => {
    createTorrentOptionsMenu(torrent, point)
})

ipcMain.on('open-downloads-folder', (e) => {
    if (fs.existsSync(downloadPath) === false) {
        fs.mkdirSync(downloadPath)
    }
    shell.openPath(downloadPath)
})

ipcMain.on('open-torrent', (e, torrent) => {
    let torrentPath = path.join(torrent.path, torrent.name)
    if (fs.existsSync(torrentPath)) {
        shell.openExternal('file://' + torrentPath)
    } else {
        let title = 'File not found'
        let message = `The torrent files might have been deleted.
                        You can make a right click and select Restart torrent to download it from the beginning.`
        dialog.showErrorBox(title, message)
    }
})

ipcMain.on('minimize:main-window', () => mainWindow.minimize())

ipcMain.on('maximize:main-window', () => mainWindow.maximize())

ipcMain.on('unmaximize:main-window', () => mainWindow.unmaximize())

ipcMain.on('close:main-window', () => mainWindow.close())

function importWebTorrent(app) {
    // app.isPackaged ? '../app.asar.unpacked/node_modules/webtorrent/index.js' : 
    return import('webtorrent')
}

function finish() {
    if (interval) clearInterval(interval)
    let torrents = webTorrentClient.torrents.map((torrent) => ({
        name: torrent.name,
        infoHash: torrent.infoHash,
        magnetURI: torrent.magnetURI,
        paused: torrent.paused,
        path: torrent.path
    }))
    fs.writeFileSync(path.join(app.getPath('userData'), 'History.json'), JSON.stringify(torrents))
    fs.writeFileSync(path.join(app.getPath('userData'), 'Settings.json'), JSON.stringify(settings))
    webTorrentClient.destroy((error) => app.quit())
}

function createAppMenu() {
    let menu = process.platform !== 'darwin' ? null : Menu.buildFromTemplate([        {
            label: 'MagTorrent',
            submenu: [
                {
                    label: 'About MagTorrent',
                    click: showAboutDialog
                },
                { type: 'separator' },
                {
                    label: 'Set Download folder',
                    click: setDownloadFolder,
                },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                {
                    label: 'Quit MagTorrent',
                    accelerator: 'Cmd+q',
                    click: () => BrowserWindow.getAllWindows().forEach((window) => window.close())
                }
            ]
        },
        {
            label: 'File',
            submenu: [
                {
                    label: 'Add from Torrent file',
                    click: addTorrentFromFile,
                },
                { type: 'separator' },
                {
                    label: 'Start all transfers',
                    click: startAllTransfers,
                },
                {
                    label: 'Stop all transfers',
                    click: stopAllTransfers
                },
            ]
        },
        { role: 'editMenu' },
        { role: 'viewMenu', visible: app.isPackaged === false },
        { role: 'windowMenu' }
    ])
    Menu.setApplicationMenu(menu)
}

function createAppOptionsMenu(point) {
    let menu = Menu.buildFromTemplate([
        {
            label: 'Add from Torrent file',
            click: addTorrentFromFile,
        },
        {
            type: 'separator'
        },
        {
            label: 'Start all transfers',
            click: startAllTransfers,
        },
        {
            label: 'Stop all transfers',
            click: stopAllTransfers
        },
        {
            type: 'separator'
        },
        {
            label: 'Set Download folder',
            click: setDownloadFolder,
        },
        {
            type: 'separator'
        },
        {
            label: 'About MagTorrent',
            click: showAboutDialog
        }
    ])
    menu.popup(point)
}

function createTorrentOptionsMenu({ infoHash }, point) {
    webTorrentClient.get(infoHash).then((torrent) => {
        let torrentPath = path.join(torrent.path, torrent.name)
        let doesTorrentExist = fs.existsSync(torrentPath)
        let menu =  Menu.buildFromTemplate(
        torrent !== null ? [
            {
                label: doesTorrentExist ? 'Show in Finder' : 'Restart torrent',
                click: () => {
                    if (doesTorrentExist) {
                        let fn = fs.lstatSync(torrentPath).isDirectory() ? shell.openPath : shell.showItemInFolder
                        fn(torrentPath)
                    } else {
                        let magnetURI = torrent.magnetURI
                        torrent.destroy()
                        mainWindow.webContents.send('remove-torrent', torrent.infoHash)
                        webTorrentClient.add(magnetURI, { path: downloadPath })
                    }
                }
            },
            {
                type: 'separator'
            },
            {
                label: torrent.paused ? 'Resume transfer' : 'Stop transfer',
                enabled: doesTorrentExist,
                click: () => {
                    if (torrent.paused) {
                        torrent.resume()
                        mainWindow.webContents.send('resume-torrent', torrent.infoHash)
                    } else {
                        torrent.pause()
                        mainWindow.webContents.send('pause-torrent', torrent.infoHash)
                    }
                }
            },
            {
                label: 'Stop and delete from list',
                click: () => {
                    torrent.destroy()
                    mainWindow.webContents.send('remove-torrent', torrent.infoHash)
                }
            },
            {
                label: 'Delete torrent and files',
                click: () => {
                    torrent.destroy(() => fs.rmSync(path.join(torrent.path, torrent.name), { recursive: true }))
                    mainWindow.webContents.send('remove-torrent', torrent.infoHash)
                }
            },
            {
                type: 'separator'
            },
            {
                label: 'Copy Magnet URL',
                click: () => clipboard.writeText(torrent.magnetURI)
            },
            {
                label: 'Copy Info Hash',
                click: () => clipboard.writeText(torrent.infoHash)
            }
        ] : [
            {
                label: 'Delete torrent',
                click: () => console.log('Delete from list')
            }
        ])
        menu.popup(point)
        menu.on('menu-will-close', (e) => mainWindow.webContents.send('options-menu-closed'))
    })
}

function createMainWindow() {
    let platform = process.platform
    let dark = nativeTheme.shouldUseDarkColors
    mainWindow = new BrowserWindow({
        backgroundColor: dark ? (platform === 'darwin' ? '#202020' : '#00000') : '#FFFFFF',
        height: 600,
        minHeight: 400,
        minWidth: 600,
        width: 800,
        fullscreenable: false,
        titleBarStyle: 'hiddenInset',
        webPreferences: {
            contextIsolation: false,
            nodeIntegration: true,
            scrollBounce: false
        }
    })
    if (platform === 'darwin') {
        mainWindow.setWindowButtonPosition({ x: 12, y: 16 })
    }
    if (os.platform() === 'darwin' && platform !== 'darwin') {
        mainWindow.setWindowButtonVisibility(false)
    }
    mainWindow.loadFile('src/view/index.html')
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.send('platform', platform, dark)
        if (interval === undefined) interval = setInterval(updateTorrents, 3000)
    })
    mainWindow.on('close', (e) => {
        let okayToClose = true
        for (let torrent of webTorrentClient.torrents) {
            if (torrent.done === false && fs.existsSync(path.join(torrent.path, torrent.name))) {
                okayToClose = false
                break
            }
        }
        if (okayToClose === false) {
            let response = dialog.showMessageBoxSync(mainWindow, {
                message: 'Some downloads are not finished',
                detail: 'Are you sure want to quit MagTorrent? You can minize the app to hide the app window.',
                buttons: ['Cancel', 'Minimize', 'Quit'],
                noLink: true
            })
            switch (response) {
                case 0:
                    e.preventDefault()
                    break
                case 1:
                    e.preventDefault()
                    mainWindow.minimize()
                    break
            }
        }
    })
}

function showAboutDialog(menuItem, browserWindow, event) {
    const build_date = '2023'
    dialog.showMessageBox({
        message: 'MagTorrent',
        detail: 'Version ' + app.getVersion() + ' (' + build_date + ')\nDeveloped by YUH APPS'
    })
}

function addTorrentFromFile(menuItem, browserWindow, event) {

}

function setDownloadFolder(menuItem, browserWindow, event) {
    dialog.showOpenDialog(browserWindow, {
        defaultPath: downloadPath,
        properties: ['createDirectory', 'openDirectory']
    }).then(({ canceled, filePaths }) => {
        if (canceled || filePaths.length === 0) return
        downloadPath = filePaths[0]
    })
}

function startAllTransfers(menuItem, browserWindow, event) {
    webTorrentClient.torrents.forEach((torrent) => {
        if (fs.existsSync(path.join(torrent.path, torrent.name)) === false) {
            let magnetURI = torrent.magnetURI
            torrent.destroy()
            webTorrentClient.add(magnetURI, { path: downloadPath })
        } else if (torrent.paused) {
            torrent.resume()
        }
    })
}

function stopAllTransfers(menuItem, browserWindow, event) {
    webTorrentClient.torrents.forEach((torrent) => torrent.pause())
}

function deleteAllTransfers(menuItem, browserWindow, event) {
    dialog.showMessageBox(browserWindow, {
        message: 'Delete all current transfers?',
        buttons: ['Delete all transfers and keep files', 'Delete all transfers and delete files', 'Cancel'],
        defaultId: 2,
        noLink: true,
        type: 'question',
    }).then(({ response }) => {
        if (response === 2) return
        webTorrentClient.torrents.forEach((torrent) => {
            let infoHash = torrent.infoHash
            let torrentPath = path.join(torrent.path, torrent.name)
            torrent.destroy(() => {
                mainWindow.webContents.send('remove-torrent', infoHash)
                if (response === 1) fs.rmSync(torrentPath, { recursive: true }) 
            })
        })
    })
}

function updateTorrents() {
    let torrents = webTorrentClient.torrents.map((torrent) => ({
        name: torrent.name, infoHash: torrent.infoHash, magnetURI: torrent.magnetURI,
        timeRemaining: torrent.timeRemaining, received: torrent.received, downloaded: torrent.downloaded, uploaded: torrent.uploaded,
        downloadSpeed: torrent.downloadSpeed, uploadSpeed: torrent.uploadSpeed, progress: torrent.progress, path: torrent.path,
        ready: torrent.ready, paused: torrent.paused, done: torrent.done, length: torrent.length, source: torrent.source || 'session',
        error: fs.existsSync(path.join(torrent.path, torrent.name)) ? undefined : `Target folder/file does not exist`
    }))
    mainWindow.webContents.send('update-torrents', torrents || [])
}

function onTorrent(torrent) {
    if (torrent.source === 'history') return
    torrent.on('done', () => {
        new Notification({ title: `${torrent.name} has been downloaded`, silent: true }).show()
        mainWindow.webContents.send('torrent-done', torrent.infoHash, torrent.length)
    })
}

function onError(error) {
    dialog.showErrorBox('Error', 'An error ocurred.\n' + error)
}