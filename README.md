# MAGTORRENT: A torrent app for Desktop platforms.

MagTorrent is a torrent app for Windows, Mac and Linux powered by [WebTorrent](https://github.com/webtorrent/webtorrent) and [Electron](https://github.com/electron/electron). The goal of this projects is to build a simple open source torrent application for desktop platforms with these ideas:

* Modern versions of **NodeJS, WebTorrent, and Electron**.
* WebTorrent is used in the backend, which is the Electron main process, not the Electron renderer (the browser) process.
* Just a torrent client with no other purposes than downloading and seeding. No PDF preview, no video playback. Each desktop platform has great apps for those purposes, so it's unnecessary for MagTorrent to take care of that part.
* Surprisingly simple code in the frontend with pure HTML, CSS and JS. No React, no Angular, no Vue, no Svelte. Therefore it puts less CPU usage and Memory resource on end-users' computers, and every developer does not take much time to understand the code.
* Further more, when there are new versions of WebTorrent and Electron but MagTorrent is not updated, you as a developer can just fork this project, update the dependencies and you'll have a good chance to have your own working MagTorrent app.
* It just works!!!

**Currently there are no pre-built binaries. They're coming soon. Supported platforms will be Mac (Intel and Apple Silicon), 64 bit Windows and Linux.**

**How to build and run the app on your computer, assuming you have Git and NodeJS installed:**

```
% git clone https://github.com/YuhApps/MagTorrent.git
% cd MagTorrent
% npm install
% npm start
```

**To package the project as an app, make sure you have [Electron Builder](https://electron.build) installed as a global package. Local Electron Builder has issues when building native dependencies. Until the problem is solved, this must be the way.**
```
% npm i -g electron-builder
% electron-builder
```