// music player rpc server
// require modules
const express = require('express');
const fs = require('fs');
const mm = require('music-metadata');
const FileType = require('file-type');
const cors = require('cors');

// create express app
const app = express();
app.use(cors());
const port = 13525;
const url = `http://localhost:${port}`;

// function to format seconds to mm:ss
function formatSeconds(seconds) {
    const minutes = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${minutes}:${sec < 10 ? '0' : ''}${sec}`;
}

// function to convert a file path into a music file object
async function createMusicFileObject(path) {
    // read file metadata
    let metadata = await mm.parseFile(path);

    // create id
    // const id = `${metadata.common.artist}_${metadata.common.album}_${metadata.common.track.no}`

    // create music file object
    return {
        // id: id,
        icon: `${url}/icon/${metadata.common.artist}/${metadata.common.album}`,
        title: metadata.common.title,
        artist: metadata.common.artist,
        album: metadata.common.album,
        duration: formatSeconds(metadata.format.duration),
        audioUrl: `${url}/audio/${metadata.common.artist}/${metadata.common.album}/${metadata.common.title}`
    }
}

// list music files
app.get('/list', async (request, response) => {
    // read music files
    const home = process.env.HOME || process.env.USERPROFILE;
    const path = `${home}/Music`;
    const files = fs.readdirSync(path, { recursive: true });

    // create music file objects
    const musicFiles = [];
    for (let file of files) {
        file = `${path}/${file}`;
        // detect if directory
        if (fs.lstatSync(file).isDirectory()) {
            continue;
        }

        // detect if music file
        const fileType = await FileType.fromFile(file);
        if (!fileType || !fileType.mime.startsWith('audio')) {
            continue;
        }

        // add music file object
        musicFiles.push(await createMusicFileObject(file));
    }

    // send music files
    response.json(musicFiles);
});

// get icon
app.get('/icon/:artist/:album', async (request, response) => {
    // read music files
    const home = process.env.HOME;
    let path = `${home}/Music/${request.params.artist}/${request.params.album}/cover.jpg`;

    response.sendFile(path);
});

// get audio
app.get('/audio/:artist/:album/:title', async (request, response) => {
    // read music files
    const home = process.env.HOME;
    let path = `${home}/Music/${request.params.artist}/${request.params.album}/`;
    const files = fs.readdirSync(path, { recursive: true });

    let file = '';
    for (let f of files) {
        if (f.includes(request.params.title)) {
            file = f;
            break;
        }
    }

    response.sendFile(`${path}/${file}`);
});

// start server
app.listen(port, () => {
    console.log(`Server started at ${url}`);
});