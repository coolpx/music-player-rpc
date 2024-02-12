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

// format seconds to mm:ss
function formatSeconds(seconds) {
    const minutes = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${minutes}:${sec < 10 ? '0' : ''}${sec}`;
}

// return the user's home directory
function getUserHome() {
    return process.env.HOME || process.env.USERPROFILE;
}

// return the music directory
function getMusicPath() {
    return [getUserHome(), 'Music'].join('/');
}

// get the destination path for an audio file's extracted cover
function getEmbeddedCoverPath(audioPath) {
    return audioPath.split('.').slice(0, -1).join('.') + '.jpg';
}

// extract cover from audio file
async function extractCover(audioPath) {
    // read metadata
    const metadata = await mm.parseFile(audioPath);

    // check for embedded cover
    if (metadata.common.picture && metadata.common.picture.length > 0) {
        const picture = metadata.common.picture[0];
        const coverPath = getEmbeddedCoverPath(audioPath);
        fs.writeFileSync(coverPath, picture.data);

        return coverPath;
    }
}

// get the cover path of an audio file
async function getCoverPath(audioPath) {
    // check for embedded cover
    let path = await extractCover(audioPath);

    // check for cover.jpg
    if (!path) {
        const coverPath = getAlbumCoverPath(audioPath);
        if (fs.existsSync(coverPath)) {
            path = coverPath;
        }
    }

    // return path
    return path;
}

// convert a file path into a music file object
async function createMusicFileObject(path) {
    // read file metadata
    let metadata = await mm.parseFile(path);

    // get relative path
    path = path.substring(getMusicPath().length + 1);

    // create music file object
    return {
        icon: `${url}/icon/${path}`,
        title: metadata.common.title,
        artist: metadata.common.artist,
        album: metadata.common.album,
        duration: formatSeconds(metadata.format.duration),
        audioUrl: `${url}/audio/${path}`
    }
}

// list music files
app.get('/list', async (request, response) => {
    // read music files
    const path = getMusicPath();
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
        if (!fileType || !fileType.mime.startsWith('audio/') || file.endsWith('.ini')) continue;

        // add music file object
        musicFiles.push(await createMusicFileObject(file));
    }

    // set cache-control header
    response.set('Cache-Control', 'max-age=60, stale-while-revalidate=120, private');

    // send music files
    response.json(musicFiles);
});

// get icon
app.get('/icon/*', async (request, response) => {
    // get path
    let musicFilePath = [getMusicPath(), request.params[0]].join('/');

    // get cover path
    const path = await getCoverPath(musicFilePath);

    // check if file exists
    if (!fs.existsSync(path)) return response.status(404).send('Not found');

    // set cache-control header
    response.set('Cache-Control', 'max-age=2592000, stale-while-revalidate=2678000, private');

    // send icon
    response.sendFile(path);
});

// get audio
app.get('/audio/*', async (request, response) => {
    // read music files
    const path = [getMusicPath(), request.params[0]].join('/');

    // set cache-control header
    response.set('Cache-Control', 'max-age=2592000, stale-while-revalidate=2678000, private');

    // send audio
    response.sendFile(path);
});

// start server
app.listen(port, () => {
    console.log(`Server started at ${url}`);
});