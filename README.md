# 🎵 Rishi Music

Rishi Music is a personal offline music player Progressive Web App (PWA).

It is designed to store music locally on the device using IndexedDB.

---

## Features

### 🎵 Music

- Import individual songs
- Import multiple songs
- Import complete music folders
- Offline playback
- Automatic next song
- Previous song
- Play / Pause
- Seek
- Shuffle
- Repeat
- Search

### 🎼 Music Directors

Songs can be grouped by music director.

The library can be filtered by director.

Automatic playback tries to select a different music director when possible.

### ❤️ Favorites

Songs can be added to or removed from favorites.

### 📋 Playlists

Users can create playlists and add songs to them.

### 📅 Daily Automatic Playback

Rishi Music maintains a daily automatic-play history.

A song that has already been automatically played during the current day is not selected again by the automatic-play system.

The automatic history is based on the local date.

### 💾 IndexedDB Storage

Imported audio files are stored directly inside IndexedDB as file Blobs.

The GitHub repository does NOT contain the user's imported songs.

Example:

Your device:

    Song.mp3
        ↓
    Rishi Music
        ↓
    IndexedDB
        ↓
    RishiMusicDB
        ↓
    tracks

---

## Persistent Storage

Rishi Music requests persistent browser storage using:

    navigator.storage.persist()

This asks the browser to protect the application's stored data from automatic storage cleanup.

However, browser storage is still controlled by the operating system and browser.

If the user explicitly clears the website/browser storage, IndexedDB data may be deleted.

No normal web application can guarantee that data survives an explicit browser/site-data deletion.

---

## Offline Operation

The service worker caches the application files:

- index.html
- style.css
- app.js
- manifest.json
- icon-192.png
- icon-512.png

The music files themselves are stored in IndexedDB.

Therefore:

    App files
        ↓
    Service Worker Cache

    Music files
        ↓
    IndexedDB

---

## PWA Installation

Rishi Music can be installed on supported browsers.

After installation it can appear as:

    Rishi Music

on the device's application/home screen.

The application uses:

    display: standalone

so it can run without the normal browser interface when installed as a PWA.

---

## Media Controls

Rishi Music uses the browser Media Session API when supported.

Supported devices/browsers may provide:

- Play
- Pause
- Next
- Previous
- Lock-screen controls
- Bluetooth media controls

Availability depends on the browser and operating system.

---

## Project Files

    rishify/
    │
    ├── index.html
    ├── style.css
    ├── app.js
    ├── manifest.json
    ├── sw.js
    ├── icon-192.png
    ├── icon-512.png
    └── README.md

---

## GitHub Pages

The application can be hosted using GitHub Pages.

GitHub stores the application code.

The user's imported music remains on the user's device in IndexedDB.

Therefore, importing a song does NOT upload that song to GitHub.

---

## Important Storage Warning

Do not clear the site's browser data if you want to keep your imported music.

For example, clearing:

    Chrome
    ↓
    Site data
    ↓
    Rishi Music
    ↓
    IndexedDB

can remove the locally stored music.

The application requests persistent storage, but explicit user deletion of browser/site data can still remove the data.

---

## Technology

Rishi Music uses:

- HTML
- CSS
- JavaScript
- IndexedDB
- Service Worker
- Web App Manifest
- Media Session API

No Python or Kivy is required.

---

## Application Name

Rishi Music

Personal Offline Audio Station

---

## Theme

Glossy Blue

Primary colors are based around dark blue and bright blue.

---

## Version

2.0.0