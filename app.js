"use strict";


/* =========================================================
   RISHI MUSIC
   IndexedDB Offline Music Engine
========================================================= */


/* =========================================================
   DATABASE
========================================================= */

const DB_NAME = "RishiMusicDB";
const DB_VERSION = 3;

const STORE_TRACKS = "tracks";
const STORE_PLAYLISTS = "playlists";
const STORE_HISTORY = "history";
const STORE_SETTINGS = "settings";


let db = null;


/* =========================================================
   APPLICATION STATE
========================================================= */

let songs = [];

let currentSong = null;
let currentIndex = -1;

let searchQuery = "";

let activeDirector = null;

let isShuffle = false;

let repeatMode = "off";
// off
// one
// all

let autoQueue = [];

let autoHistory = new Set();

let recentSongs = [];

let blobUrl = null;

let deferredInstallPrompt = null;

let isPlaying = false;


/* =========================================================
   AUDIO
========================================================= */

const audio = new Audio();

audio.preload = "metadata";

audio.volume = 1;

audio.crossOrigin = "anonymous";


/* =========================================================
   DOM
========================================================= */

const $ = id => document.getElementById(id);


/* =========================================================
   OPEN DATABASE
========================================================= */

function openDatabase() {

    return new Promise((resolve, reject) => {

        const request =
            indexedDB.open(
                DB_NAME,
                DB_VERSION
            );


        request.onupgradeneeded = event => {

            const database =
                event.target.result;


            if (
                !database.objectStoreNames.contains(
                    STORE_TRACKS
                )
            ) {

                const tracks =
                    database.createObjectStore(
                        STORE_TRACKS,
                        {
                            keyPath: "id",
                            autoIncrement: true
                        }
                    );


                tracks.createIndex(
                    "title",
                    "title",
                    {
                        unique: false
                    }
                );


                tracks.createIndex(
                    "director",
                    "director",
                    {
                        unique: false
                    }
                );


                tracks.createIndex(
                    "dateAdded",
                    "dateAdded",
                    {
                        unique: false
                    }
                );

            }


            if (
                !database.objectStoreNames.contains(
                    STORE_PLAYLISTS
                )
            ) {

                database.createObjectStore(
                    STORE_PLAYLISTS,
                    {
                        keyPath: "id",
                        autoIncrement: true
                    }
                );

            }


            if (
                !database.objectStoreNames.contains(
                    STORE_HISTORY
                )
            ) {

                const history =
                    database.createObjectStore(
                        STORE_HISTORY,
                        {
                            keyPath: "id",
                            autoIncrement: true
                        }
                    );


                history.createIndex(
                    "date",
                    "date",
                    {
                        unique: false
                    }
                );


                history.createIndex(
                    "songId",
                    "songId",
                    {
                        unique: false
                    }
                );

            }


            if (
                !database.objectStoreNames.contains(
                    STORE_SETTINGS
                )
            ) {

                database.createObjectStore(
                    STORE_SETTINGS,
                    {
                        keyPath: "key"
                    }
                );

            }

        };


        request.onsuccess = event => {

            db = event.target.result;

            resolve(db);

        };


        request.onerror = () => {

            reject(
                request.error
            );

        };

    });

}


/* =========================================================
   DATABASE HELPERS
========================================================= */

function dbRequest(
    storeName,
    mode,
    operation
) {

    return new Promise(
        (resolve, reject) => {

            const transaction =
                db.transaction(
                    storeName,
                    mode
                );


            const store =
                transaction.objectStore(
                    storeName
                );


            let request;

            try {

                request =
                    operation(store);

            } catch (error) {

                reject(error);

                return;

            }


            request.onsuccess = () => {

                resolve(
                    request.result
                );

            };


            request.onerror = () => {

                reject(
                    request.error
                );

            };

        }
    );

}


/* =========================================================
   LOAD ALL SONGS
========================================================= */

async function loadSongs() {

    songs =
        await dbRequest(
            STORE_TRACKS,
            "readonly",
            store => store.getAll()
        );


    songs.sort(
        (a, b) =>
            String(a.title)
                .localeCompare(
                    String(b.title)
                )
    );


    renderEverything();

}


/* =========================================================
   SAVE SONG
========================================================= */

async function saveSong(song) {

    return dbRequest(
        STORE_TRACKS,
        "readwrite",
        store => store.put(song)
    );

}


/* =========================================================
   DELETE SONG
========================================================= */

async function deleteSong(id) {

    const song =
        songs.find(
            s => s.id === id
        );


    if (!song) {
        return;
    }


    if (
        currentSong &&
        currentSong.id === id
    ) {

        stopPlayback();

    }


    await dbRequest(
        STORE_TRACKS,
        "readwrite",
        store => store.delete(id)
    );


    await dbRequest(
        STORE_HISTORY,
        "readwrite",
        store => {

            const request =
                store.getAll();

            request.onsuccess = () => {

                request.result.forEach(
                    item => {

                        if (
                            item.songId === id
                        ) {

                            store.delete(
                                item.id
                            );

                        }

                    }
                );

            };

            return request;

        }
    );


    songs =
        songs.filter(
            s => s.id !== id
        );


    showToast(
        "Song deleted"
    );


    renderEverything();

}


/* =========================================================
   IMPORT MUSIC
========================================================= */

async function importFiles(files) {

    if (!files || files.length === 0) {
        return;
    }


    let imported = 0;

    let skipped = 0;


    for (
        const file of Array.from(files)
    ) {

        if (
            !file.type.startsWith("audio/") &&
            !isAudioFile(file.name)
        ) {

            skipped++;

            continue;

        }


        try {

            const metadata =
                await askSongMetadata(
                    file.name
                );


            if (!metadata) {
                continue;
            }


            const song = {

                title:
                    metadata.title ||
                    removeExtension(
                        file.name
                    ),

                director:
                    metadata.director ||
                    "UNKNOWN DIRECTOR",

                artist:
                    metadata.artist ||
                    "",

                album:
                    metadata.album ||
                    "",

                filename:
                    file.name,

                mimeType:
                    file.type ||
                    "audio/mpeg",

                size:
                    file.size,

                blob:
                    file,

                dateAdded:
                    new Date().toISOString(),

                favorite:
                    false

            };


            await saveSong(song);

            imported++;

        } catch (error) {

            console.error(
                "Import error:",
                error
            );

            skipped++;

        }

    }


    await loadSongs();


    showToast(
        `${imported} song(s) imported` +
        (
            skipped
                ? ` • ${skipped} skipped`
                : ""
        )
    );

}


/* =========================================================
   AUDIO FILE CHECK
========================================================= */

function isAudioFile(name) {

    const extensions = [
        ".mp3",
        ".m4a",
        ".aac",
        ".wav",
        ".ogg",
        ".flac",
        ".opus"
    ];


    const lower =
        name.toLowerCase();


    return extensions.some(
        ext =>
            lower.endsWith(ext)
    );

}


/* =========================================================
   REMOVE EXTENSION
========================================================= */

function removeExtension(name) {

    return name.replace(
        /\.[^/.]+$/,
        ""
    );

}


/* =========================================================
   ASK METADATA
========================================================= */

function askSongMetadata(filename) {

    return new Promise(resolve => {

        const content =
            document.createElement(
                "div"
            );


        const title =
            document.createElement(
                "input"
            );

        title.className =
            "modal-input";

        title.placeholder =
            "Song name";

        title.value =
            removeExtension(
                filename
            );


        const director =
            document.createElement(
                "input"
            );

        director.className =
            "modal-input";

        director.placeholder =
            "Music director";

        director.value =
            "UNKNOWN DIRECTOR";


        const artist =
            document.createElement(
                "input"
            );

        artist.className =
            "modal-input";

        artist.placeholder =
            "Artist (optional)";


        const album =
            document.createElement(
                "input"
            );

        album.className =
            "modal-input";

        album.placeholder =
            "Album (optional)";


        content.appendChild(title);
        content.appendChild(director);
        content.appendChild(artist);
        content.appendChild(album);


        $("modalTitle").textContent =
            "Add Music";


        $("modalContent")
            .innerHTML = "";

        $("modalContent")
            .appendChild(content);


        $("modal").classList.remove(
            "hidden"
        );


        const confirm =
            $("modalConfirm");

        const cancel =
            $("modalCancel");


        const cleanup = () => {

            $("modal")
                .classList.add(
                    "hidden"
                );

            confirm.onclick = null;
            cancel.onclick = null;

        };


        confirm.onclick = () => {

            const result = {

                title:
                    title.value.trim(),

                director:
                    director.value.trim() ||
                    "UNKNOWN DIRECTOR",

                artist:
                    artist.value.trim(),

                album:
                    album.value.trim()

            };


            cleanup();

            resolve(result);

        };


        cancel.onclick = () => {

            cleanup();

            resolve(null);

        };

    });

}


/* =========================================================
   PLAY SONG
========================================================= */

async function playSong(
    song,
    automatic = false
) {

    if (!song) {
        return;
    }


    try {

        if (blobUrl) {

            URL.revokeObjectURL(
                blobUrl
            );

            blobUrl = null;

        }


        blobUrl =
            URL.createObjectURL(
                song.blob
            );


        audio.src = blobUrl;

        audio.currentTime = 0;


        currentSong = song;

        currentIndex =
            songs.findIndex(
                s => s.id === song.id
            );


        audio.onloadedmetadata =
            () => {

                updatePlayer();

            };


        await audio.play();


        isPlaying = true;


        if (automatic) {

            await markAutomaticallyPlayed(
                song
            );

        }


        addRecent(song);

        updatePlayer();

        renderLibrary();

    } catch (error) {

        console.error(
            "Playback error:",
            error
        );

        showToast(
            "Unable to play this song"
        );

    }

}


/* =========================================================
   STOP
========================================================= */

function stopPlayback() {

    audio.pause();

    audio.currentTime = 0;

    isPlaying = false;

    updatePlayer();

}


/* =========================================================
   PAUSE / RESUME
========================================================= */

async function togglePlayback() {

    if (!currentSong) {

        const song =
            chooseAutomaticSong();

        if (song) {

            await playSong(
                song,
                true
            );

        }

        return;

    }


    if (audio.paused) {

        try {

            await audio.play();

            isPlaying = true;

        } catch (error) {

            console.error(error);

        }

    } else {

        audio.pause();

        isPlaying = false;

    }


    updatePlayer();

}


/* =========================================================
   NEXT SONG
========================================================= */

async function nextSong(
    automatic = false
) {

    if (
        repeatMode === "one" &&
        currentSong &&
        automatic
    ) {

        await playSong(
            currentSong,
            true
        );

        return;

    }


    let song = null;


    if (automatic) {

        song =
            chooseAutomaticSong();

    } else {

        song =
            chooseManualNextSong();

    }


    if (!song) {

        stopPlayback();

        showToast(
            automatic
                ? "Today's automatic songs are finished"
                : "No next song"
        );

        return;

    }


    await playSong(
        song,
        automatic
    );

}


/* =========================================================
   PREVIOUS
========================================================= */

async function previousSong() {

    if (!currentSong) {
        return;
    }


    if (audio.currentTime > 5) {

        audio.currentTime = 0;

        return;

    }


    let index =
        currentIndex - 1;


    if (index < 0) {

        index =
            songs.length - 1;

    }


    if (songs[index]) {

        await playSong(
            songs[index],
            false
        );

    }

}


/* =========================================================
   MANUAL NEXT
========================================================= */

function chooseManualNextSong() {

    if (!songs.length) {
        return null;
    }


    if (isShuffle) {

        const candidates =
            songs.filter(
                song =>
                    !currentSong ||
                    song.id !== currentSong.id
            );


        if (!candidates.length) {
            return songs[0];
        }


        return randomItem(
            candidates
        );

    }


    let index =
        currentIndex + 1;


    if (index >= songs.length) {

        index = 0;

    }


    return songs[index] || null;

}


/* =========================================================
   DAILY AUTO PLAY
========================================================= */

function todayKey() {

    const now =
        new Date();

    return (
        now.getFullYear() +
        "-" +
        String(
            now.getMonth() + 1
        ).padStart(2, "0") +
        "-" +
        String(
            now.getDate()
        ).padStart(2, "0")
    );

}


/* =========================================================
   LOAD TODAY HISTORY
========================================================= */

async function loadTodayHistory() {

    const today =
        todayKey();


    const history =
        await dbRequest(
            STORE_HISTORY,
            "readonly",
            store =>
                store.getAll()
        );


    autoHistory =
        new Set(
            history
                .filter(
                    item =>
                        item.date === today
                )
                .map(
                    item =>
                        item.songId
                )
        );

}


/* =========================================================
   MARK AUTOMATICALLY PLAYED
========================================================= */

async function markAutomaticallyPlayed(
    song
) {

    if (!song || !song.id) {
        return;
    }


    const today =
        todayKey();


    if (
        autoHistory.has(
            song.id
        )
    ) {

        return;

    }


    await dbRequest(
        STORE_HISTORY,
        "readwrite",
        store => {

            return store.add({

                songId:
                    song.id,

                date:
                    today,

                playedAt:
                    new Date().toISOString()

            });

        }
    );


    autoHistory.add(
        song.id
    );

}


/* =========================================================
   CHOOSE AUTOMATIC SONG
========================================================= */

function chooseAutomaticSong() {

    let candidates =
        songs.filter(
            song =>
                !autoHistory.has(
                    song.id
                )
        );


    if (
        activeDirector
    ) {

        candidates =
            candidates.filter(
                song =>
                    song.director ===
                    activeDirector
            );

    }


    if (!candidates.length) {

        return null;

    }


    /*
       Prefer a different director
       from the current song.
    */

    if (currentSong) {

        const differentDirector =
            candidates.filter(
                song =>
                    song.director !==
                    currentSong.director
            );


        if (
            differentDirector.length
        ) {

            candidates =
                differentDirector;

        }

    }


    if (isShuffle) {

        return randomItem(
            candidates
        );

    }


    /*
       Random selection gives a large
       and varied automatic queue.
    */

    return randomItem(
        candidates
    );

}


/* =========================================================
   RANDOM
========================================================= */

function randomItem(array) {

    if (!array.length) {
        return null;
    }


    return array[
        Math.floor(
            Math.random() *
            array.length
        )
    ];

}


/* =========================================================
   RECENT SONGS
========================================================= */

function addRecent(song) {

    recentSongs =
        recentSongs.filter(
            s =>
                s.id !== song.id
        );


    recentSongs.unshift(
        song
    );


    recentSongs =
        recentSongs.slice(
            0,
            20
        );


    saveSetting(
        "recentSongs",
        recentSongs.map(
            s => s.id
        )
    );


    renderRecent();

}


/* =========================================================
   FAVORITE
========================================================= */

async function toggleFavorite(id) {

    const song =
        songs.find(
            s => s.id === id
        );


    if (!song) {
        return;
    }


    song.favorite =
        !song.favorite;


    await saveSong(song);


    if (
        currentSong &&
        currentSong.id === id
    ) {

        currentSong =
            song;

    }


    renderEverything();


    showToast(
        song.favorite
            ? "Added to favorites"
            : "Removed from favorites"
    );

}


/* =========================================================
   PLAYLISTS
========================================================= */

async function getPlaylists() {

    return dbRequest(
        STORE_PLAYLISTS,
        "readonly",
        store =>
            store.getAll()
    );

}


async function createPlaylist() {

    const name =
        await askText(
            "New Playlist",
            "Playlist name"
        );


    if (!name) {
        return;
    }


    const playlists =
        await getPlaylists();


    const exists =
        playlists.some(
            playlist =>
                playlist.name
                    .toLowerCase() ===
                name.toLowerCase()
        );


    if (exists) {

        showToast(
            "Playlist already exists"
        );

        return;

    }


    await dbRequest(
        STORE_PLAYLISTS,
        "readwrite",
        store => {

            return store.add({

                name,
                songIds: []

            });

        }
    );


    renderPlaylists();

    showToast(
        "Playlist created"
    );

}


/* =========================================================
   ADD SONG TO PLAYLIST
========================================================= */

async function addSongToPlaylist(
    song
) {

    const playlists =
        await getPlaylists();


    if (!playlists.length) {

        showToast(
            "Create a playlist first"
        );

        return;

    }


    const choices =
        playlists
            .map(
                p =>
                    `${p.id}: ${p.name}`
            )
            .join("\n");


    const value =
        prompt(
            "Enter playlist ID:\n\n" +
            choices
        );


    if (!value) {
        return;
    }


    const id =
        Number(value);


    const playlist =
        playlists.find(
            p => p.id === id
        );


    if (!playlist) {

        showToast(
            "Playlist not found"
        );

        return;

    }


    if (
        !playlist.songIds.includes(
            song.id
        )
    ) {

        playlist.songIds.push(
            song.id
        );

        await dbRequest(
            STORE_PLAYLISTS,
            "readwrite",
            store =>
                store.put(
                    playlist
                )
        );

    }


    showToast(
        "Added to playlist"
    );

}


/* =========================================================
   SETTINGS
========================================================= */

async function saveSetting(
    key,
    value
) {

    try {

        await dbRequest(
            STORE_SETTINGS,
            "readwrite",
            store =>
                store.put({
                    key,
                    value
                })
        );

    } catch (error) {

        console.error(
            "Setting error:",
            error
        );

    }

}


async function getSetting(
    key,
    fallback = null
) {

    const result =
        await dbRequest(
            STORE_SETTINGS,
            "readonly",
            store =>
                store.get(key)
        );


    if (!result) {
        return fallback;
    }


    return result.value;

}


/* =========================================================
   ASK TEXT
========================================================= */

function askText(
    title,
    placeholder
) {

    return new Promise(resolve => {

        $("modalTitle")
            .textContent = title;


        $("modalContent")
            .innerHTML =
            `<input class="modal-input"
                    id="modalTextInput"
                    placeholder="${placeholder}">`;


        $("modal")
            .classList.remove(
                "hidden"
            );


        const confirm =
            $("modalConfirm");

        const cancel =
            $("modalCancel");


        const cleanup = () => {

            $("modal")
                .classList.add(
                    "hidden"
                );

            confirm.onclick = null;
            cancel.onclick = null;

        };


        confirm.onclick = () => {

            const value =
                $("modalTextInput")
                    .value
                    .trim();

            cleanup();

            resolve(value);

        };


        cancel.onclick = () => {

            cleanup();

            resolve(null);

        };

    });

}


/* =========================================================
   DIRECTORS
========================================================= */

function getDirectors() {

    const map =
        new Map();


    songs.forEach(song => {

        const director =
            song.director ||
            "UNKNOWN DIRECTOR";


        map.set(
            director,
            (map.get(director) || 0) + 1
        );

    });


    return Array.from(
        map.entries()
    )
        .sort(
            (a, b) =>
                a[0].localeCompare(
                    b[0]
                )
        );

}


/* =========================================================
   RENDER EVERYTHING
========================================================= */

function renderEverything() {

    renderLibrary();

    renderDirectors();

    renderFavorites();

    renderRecent();

    renderPlaylists();

    updateStats();

    updatePlayer();

}


/* =========================================================
   RENDER LIBRARY
========================================================= */

function renderLibrary() {

    const container =
        $("libraryList");


    container.innerHTML = "";


    let filtered =
        songs.slice();


    if (searchQuery) {

        const q =
            searchQuery
                .toLowerCase();


        filtered =
            filtered.filter(
                song =>
                    String(
                        song.title
                    )
                        .toLowerCase()
                        .includes(q) ||

                    String(
                        song.director
                    )
                        .toLowerCase()
                        .includes(q) ||

                    String(
                        song.artist
                    )
                        .toLowerCase()
                        .includes(q) ||

                    String(
                        song.album
                    )
                        .toLowerCase()
                        .includes(q)
            );

    }


    if (
        activeDirector
    ) {

        filtered =
            filtered.filter(
                song =>
                    song.director ===
                    activeDirector
            );

    }


    if (!filtered.length) {

        container.innerHTML =
            `<div class="empty">
                No songs found
             </div>`;

        return;

    }


    filtered.forEach(
        (song, index) => {

            container.appendChild(
                createSongCard(
                    song,
                    index
                )
            );

        }
    );

}


/* =========================================================
   CREATE SONG CARD
========================================================= */

function createSongCard(
    song,
    number
) {

    const card =
        document.createElement(
            "div"
        );


    card.className =
        "song-card";


    if (
        currentSong &&
        currentSong.id === song.id
    ) {

        card.classList.add(
            "playing"
        );

    }


    const numberBox =
        document.createElement(
            "div"
        );

    numberBox.className =
        "song-number";


    numberBox.textContent =
        currentSong &&
        currentSong.id === song.id
            ? "▶"
            : number + 1;


    const info =
        document.createElement(
            "div"
        );

    info.className =
        "song-info";


    const title =
        document.createElement(
            "div"
        );

    title.className =
        "song-title";

    title.textContent =
        song.title;


    const meta =
        document.createElement(
            "div"
        );

    meta.className =
        "song-meta";

    meta.textContent =
        [
            song.director,
            song.artist
        ]
            .filter(Boolean)
            .join(" • ");


    info.appendChild(title);
    info.appendChild(meta);


    const actions =
        document.createElement(
            "div"
        );

    actions.className =
        "song-actions";


    const favorite =
        document.createElement(
            "button"
        );

    favorite.className =
        "icon-btn";

    favorite.textContent =
        song.favorite
            ? "❤️"
            : "♡";


    favorite.onclick =
        event => {

            event.stopPropagation();

            toggleFavorite(
                song.id
            );

        };


    const playlist =
        document.createElement(
            "button"
        );

    playlist.className =
        "icon-btn";

    playlist.textContent =
        "＋";


    playlist.onclick =
        event => {

            event.stopPropagation();

            addSongToPlaylist(
                song
            );

        };


    const deleteBtn =
        document.createElement(
            "button"
        );

    deleteBtn.className =
        "icon-btn";

    deleteBtn.textContent =
        "🗑";


    deleteBtn.onclick =
        async event => {

            event.stopPropagation();


            const yes =
                confirm(
                    `Delete "${song.title}"?`
                );


            if (yes) {

                await deleteSong(
                    song.id
                );

            }

        };


    actions.appendChild(
        favorite
    );

    actions.appendChild(
        playlist
    );

    actions.appendChild(
        deleteBtn
    );


    card.appendChild(
        numberBox
    );

    card.appendChild(
        info
    );

    card.appendChild(
        actions
    );


    card.onclick =
        () => {

            playSong(
                song,
                false
            );

        };


    return card;

}


/* =========================================================
   DIRECTORS
========================================================= */

function renderDirectors() {

    const container =
        $("directorList");


    container.innerHTML = "";


    const directors =
        getDirectors();


    if (!directors.length) {

        container.innerHTML =
            `<div class="empty">
                No music directors yet
             </div>`;

        return;

    }


    directors.forEach(
        ([name, count]) => {

            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "director-card";


            card.innerHTML =
                `<div class="director-name">
                    ${escapeHTML(name)}
                 </div>

                 <div class="director-count">
                    ${count} song(s)
                 </div>`;


            card.onclick =
                () => {

                    activeDirector =
                        name;


                    searchQuery =
                        "";


                    $("searchInput")
                        .value = "";


                    showPage(
                        "library"
                    );


                    renderLibrary();

                };


            container.appendChild(
                card
            );

        }
    );

}


/* =========================================================
   FAVORITES
========================================================= */

function renderFavorites() {

    const container =
        $("favoriteList");


    container.innerHTML = "";


    const favorites =
        songs.filter(
            song =>
                song.favorite
        );


    if (!favorites.length) {

        container.innerHTML =
            `<div class="empty">
                No favorite songs yet
             </div>`;

        return;

    }


    favorites.forEach(
        (song, index) => {

            container.appendChild(
                createSongCard(
                    song,
                    index
                )
            );

        }
    );

}


/* =========================================================
   RECENT
========================================================= */

function renderRecent() {

    const container =
        $("recentList");


    if (!container) {
        return;
    }


    container.innerHTML = "";


    if (!recentSongs.length) {

        container.innerHTML =
            `<div class="empty">
                No recently played songs
             </div>`;

        return;

    }


    recentSongs
        .slice(0, 8)
        .forEach(
            (song, index) => {

                container.appendChild(
                    createSongCard(
                        song,
                        index
                    )
                );

            }
        );

}


/* =========================================================
   PLAYLISTS
========================================================= */

async function renderPlaylists() {

    const container =
        $("playlistList");


    if (!container) {
        return;
    }


    container.innerHTML = "";


    const playlists =
        await getPlaylists();


    if (!playlists.length) {

        container.innerHTML =
            `<div class="empty">
                No playlists yet
             </div>`;

        return;

    }


    playlists.forEach(
        playlist => {

            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "playlist-card";


            const count =
                playlist.songIds.length;


            card.innerHTML =
                `<div>
                    <strong>
                        🎵
                        ${escapeHTML(
                            playlist.name
                        )}
                    </strong>

                    <div class="song-meta">
                        ${count} song(s)
                    </div>
                 </div>`;


            const play =
                document.createElement(
                    "button"
                );


            play.className =
                "small-blue-btn";

            play.textContent =
                "▶";


            play.onclick =
                () => {

                    const playlistSongs =
                        playlist.songIds
                            .map(
                                id =>
                                    songs.find(
                                        s =>
                                            s.id === id
                                    )
                            )
                            .filter(Boolean);


                    if (
                        !playlistSongs.length
                    ) {

                        showToast(
                            "Playlist is empty"
                        );

                        return;

                    }


                    playSong(
                        playlistSongs[0],
                        false
                    );

                };


            card.appendChild(
                play
            );


            container.appendChild(
                card
            );

        }
    );

}


/* =========================================================
   STATS
========================================================= */

function updateStats() {

    $("totalSongs")
        .textContent =
        songs.length;


    $("totalDirectors")
        .textContent =
        getDirectors().length;


    $("favoriteCount")
        .textContent =
        songs.filter(
            song =>
                song.favorite
        ).length;

}


/* =========================================================
   PLAYER UI
========================================================= */

function updatePlayer() {

    if (!currentSong) {

        $("playerTitle")
            .textContent =
            "Nothing playing";

        $("playerDirector")
            .textContent =
            "Rishi Music";

        $("mainPlayButton")
            .textContent =
            "▶";

        return;

    }


    $("playerTitle")
        .textContent =
        currentSong.title;


    $("playerDirector")
        .textContent =
        [
            currentSong.director,
            currentSong.artist
        ]
            .filter(Boolean)
            .join(" • ");


    $("mainPlayButton")
        .textContent =
        audio.paused
            ? "▶"
            : "❚❚";


    $("favoriteButton")
        .textContent =
        currentSong.favorite
            ? "❤️ Favorite"
            : "♡ Favorite";


    $("progressBar").value =
        audio.duration
            ? (
                audio.currentTime /
                audio.duration
            ) * 100
            : 0;


    $("currentTime")
        .textContent =
        formatTime(
            audio.currentTime
        );


    $("durationTime")
        .textContent =
        formatTime(
            audio.duration
        );


    $("repeatButton")
        .textContent =
        repeatMode === "one"
            ? "🔂"
            : "🔁";


    $("shuffleButton")
        .style.opacity =
        isShuffle
            ? "1"
            : "0.5";


    updateMediaSession();

}


/* =========================================================
   FORMAT TIME
========================================================= */

function formatTime(seconds) {

    if (
        !seconds ||
        !Number.isFinite(seconds)
    ) {

        return "0:00";

    }


    const minutes =
        Math.floor(
            seconds / 60
        );


    const remaining =
        Math.floor(
            seconds % 60
        );


    return (
        minutes +
        ":" +
        String(
            remaining
        ).padStart(
            2,
            "0"
        )
    );

}


/* =========================================================
   SEARCH
========================================================= */

function handleSearch(value) {

    searchQuery =
        value.trim();


    activeDirector =
        null;


    renderLibrary();

}


/* =========================================================
   PAGE NAVIGATION
========================================================= */

function showPage(page) {

    document
        .querySelectorAll(
            ".page"
        )
        .forEach(
            section => {

                section.classList.remove(
                    "active"
                );

            }
        );


    const target =
        $(
            page + "Page"
        );


    if (target) {

        target.classList.add(
            "active"
        );

    }


    document
        .querySelectorAll(
            ".nav-btn"
        )
        .forEach(
            button => {

                button.classList.toggle(
                    "active",
                    button.dataset.page ===
                    page
                );

            }
        );


    if (page === "library") {
        renderLibrary();
    }

    if (page === "directors") {
        renderDirectors();
    }

    if (page === "favorites") {
        renderFavorites();
    }

    if (page === "playlists") {
        renderPlaylists();
    }

}


/* =========================================================
   HTML ESCAPE
========================================================= */

function escapeHTML(value) {

    return String(value)
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );

}


/* =========================================================
   TOAST
========================================================= */

let toastTimer = null;


function showToast(message) {

    const toast =
        $("toast");


    toast.textContent =
        message;


    toast.classList.add(
        "show"
    );


    clearTimeout(
        toastTimer
    );


    toastTimer =
        setTimeout(
            () => {

                toast.classList.remove(
                    "show"
                );

            },
            2500
        );

}


/* =========================================================
   MEDIA SESSION
========================================================= */

function setupMediaSession() {

    if (
        !("mediaSession" in navigator)
    ) {

        return;

    }


    navigator.mediaSession.setActionHandler(
        "play",
        () => {

            audio.play();

        }
    );


    navigator.mediaSession.setActionHandler(
        "pause",
        () => {

            audio.pause();

        }
    );


    navigator.mediaSession.setActionHandler(
        "nexttrack",
        () => {

            nextSong(true);

        }
    );


    navigator.mediaSession.setActionHandler(
        "previoustrack",
        () => {

            previousSong();

        }
    );

}


function updateMediaSession() {

    if (
        !("mediaSession" in navigator) ||
        !currentSong
    ) {

        return;

    }


    try {

        navigator.mediaSession.metadata =
            new MediaMetadata({

                title:
                    currentSong.title,

                artist:
                    currentSong.artist ||
                    "",

                album:
                    currentSong.album ||
                    "Rishi Music"

            });

    } catch (error) {

        console.error(
            "Media Session:",
            error
        );

    }

}


/* =========================================================
   AUDIO EVENTS
========================================================= */

audio.addEventListener(
    "play",
    () => {

        isPlaying = true;

        updatePlayer();

    }
);


audio.addEventListener(
    "pause",
    () => {

        isPlaying = false;

        updatePlayer();

    }
);


audio.addEventListener(
    "timeupdate",
    () => {

        updatePlayer();

    }
);


audio.addEventListener(
    "loadedmetadata",
    () => {

        updatePlayer();

    }
);


audio.addEventListener(
    "ended",
    async () => {

        if (
            repeatMode === "one"
        ) {

            audio.currentTime = 0;

            await audio.play();

            return;

        }


        if (
            repeatMode === "all" &&
            songs.length
        ) {

            await nextSong(
                false
            );

            return;

        }


        await nextSong(
            true
        );

    }
);


/* =========================================================
   PROGRESS SEEK
========================================================= */

$("progressBar")
    .addEventListener(
        "input",
        event => {

            if (
                !audio.duration
            ) {

                return;

            }


            audio.currentTime =
                (
                    Number(
                        event.target.value
                    ) / 100
                ) *
                audio.duration;

        }
    );


/* =========================================================
   BUTTON EVENTS
========================================================= */

$("mainPlayButton")
    .onclick =
    togglePlayback;


$("nextButton")
    .onclick =
    () =>
        nextSong(false);


$("previousButton")
    .onclick =
    previousSong;


$("shuffleButton")
    .onclick =
    () => {

        isShuffle =
            !isShuffle;


        showToast(
            isShuffle
                ? "Shuffle ON"
                : "Shuffle OFF"
        );


        updatePlayer();

    };


$("repeatButton")
    .onclick =
    () => {

        if (
            repeatMode === "off"
        ) {

            repeatMode = "one";

        } else if (
            repeatMode === "one"
        ) {

            repeatMode = "all";

        } else {

            repeatMode = "off";

        }


        showToast(
            "Repeat: " +
            repeatMode
        );


        updatePlayer();

    };


$("favoriteButton")
    .onclick =
    () => {

        if (currentSong) {

            toggleFavorite(
                currentSong.id
            );

        }

    };


$("playlistAddButton")
    .onclick =
    () => {

        if (currentSong) {

            addSongToPlaylist(
                currentSong
            );

        }

    };


/* =========================================================
   NAV EVENTS
========================================================= */

document
    .querySelectorAll(
        ".nav-btn"
    )
    .forEach(
        button => {

            button.onclick =
                () => {

                    showPage(
                        button.dataset.page
                    );

                };

        }
    );


/* =========================================================
   IMPORT EVENTS
========================================================= */

$("importButton")
    .onclick =
    () =>
        $("audioFileInput").click();


$("libraryImportButton")
    .onclick =
    () =>
        $("audioFileInput").click();


$("folderButton")
    .onclick =
    () =>
        $("folderInput").click();


$("audioFileInput")
    .addEventListener(
        "change",
        event => {

            importFiles(
                event.target.files
            );

            event.target.value = "";

        }
    );


$("folderInput")
    .addEventListener(
        "change",
        event => {

            importFiles(
                event.target.files
            );

            event.target.value = "";

        }
    );


/* =========================================================
   SEARCH EVENT
========================================================= */

$("searchInput")
    .addEventListener(
        "input",
        event => {

            handleSearch(
                event.target.value
            );

        }
    );


/* =========================================================
   PLAY ALL
========================================================= */

$("playAllButton")
    .onclick =
    async () => {

        activeDirector =
            null;


        const song =
            chooseAutomaticSong();


        if (!song) {

            showToast(
                "No songs available for automatic playback today"
            );

            return;

        }


        await playSong(
            song,
            true
        );

    };


/* =========================================================
   CREATE PLAYLIST
========================================================= */

$("createPlaylistButton")
    .onclick =
    createPlaylist;


/* =========================================================
   INSTALL PWA
========================================================= */

window.addEventListener(
    "beforeinstallprompt",
    event => {

        event.preventDefault();

        deferredInstallPrompt =
            event;

        $("installBtn")
            .hidden = false;

    }
);


$("installBtn")
    .onclick =
    async () => {

        if (
            !deferredInstallPrompt
        ) {

            return;

        }


        deferredInstallPrompt
            .prompt();


        await deferredInstallPrompt
            .userChoice;


        deferredInstallPrompt =
            null;


        $("installBtn")
            .hidden = true;

    };


window.addEventListener(
    "appinstalled",
    () => {

        $("installBtn")
            .hidden = true;


        showToast(
            "Rishi Music installed"
        );

    }
);


/* =========================================================
   SERVICE WORKER
========================================================= */

async function registerServiceWorker() {

    if (
        "serviceWorker" in navigator
    ) {

        try {

            await navigator.serviceWorker
                .register(
                    "./sw.js"
                );

            console.log(
                "Service worker registered"
            );

        } catch (error) {

            console.error(
                "Service worker error:",
                error
            );

        }

    }

}


/* =========================================================
   PERSISTENT STORAGE
========================================================= */

async function requestPersistentStorage() {

    if (
        navigator.storage &&
        navigator.storage.persist
    ) {

        try {

            const granted =
                await navigator.storage.persist();


            console.log(
                "Persistent storage:",
                granted
            );

        } catch (error) {

            console.error(
                "Persistent storage:",
                error
            );

        }

    }

}


/* =========================================================
   LOAD RECENTS
========================================================= */

async function loadRecents() {

    const ids =
        await getSetting(
            "recentSongs",
            []
        );


    if (
        !Array.isArray(ids)
    ) {

        return;

    }


    recentSongs =
        ids
            .map(
                id =>
                    songs.find(
                        song =>
                            song.id === id
                    )
            )
            .filter(Boolean);

}


/* =========================================================
   INITIALIZATION
========================================================= */

async function init() {

    try {

        await openDatabase();

        await requestPersistentStorage();

        await loadSongs();

        await loadTodayHistory();

        await loadRecents();

        renderEverything();

        setupMediaSession();

        await registerServiceWorker();


        console.log(
            "Rishi Music ready"
        );


    } catch (error) {

        console.error(
            "Initialization error:",
            error
        );


        showToast(
            "Rishi Music failed to start"
        );

    }

}


/* =========================================================
   START
========================================================= */

init();