# MediaView

Web-based file browser and media viewer inspired by h5ai. Optimized for reliable caching, fast delivery and a great experience on both mobile and desktop.

The Node backend serves a local archive directory and exposes API endpoints for listing, streaming, thumbnails, and tree hydration. The React frontend provides a folder tree, list/grid views, and a lightbox viewer.

## Features

- List, grid, and tree navigation with lightbox previews
- Path-based API endpoints for files, lists, thumbnails, and tree
- SHA-256 hash cache with background scanning and thumbnail worker
- CDN-friendly headers (ETag/Cache-Control) for file, list, tree, search, and thumbnail responses

## Structure

- `server/` Node API for directory listing and file streaming
- `client/` React UI (Vite)

## Modes

- `server`: HTTP API + watches `file-hashes.json` for updates.
- `worker`: hash-cache and thumbnail workers only.
- `combined`: server + workers (default for `npm run dev` and Docker).

## Setup

1. Point the backend at your archive directory:

```bash
export ARCHIVE_ROOT="/absolute/path/to/archive"
export CACHE_ROOT="/absolute/path/to/cache"
```

2. Install and run the backend:

```bash
cd server
npm install
npm run dev
```

`npm run dev` starts `combined` mode. To run a single mode locally:

```bash
cd server
npm start              # server mode
node index.js worker   # worker mode
node index.js combined # combined mode
```

3. Install and run the frontend:

```bash
cd client
npm install
npm run dev
```

The UI runs on `http://localhost:5173` and proxies `/api` to the backend on port `3001`.

## Excluded vs hidden entries

Use excluded patterns to block entries entirely (list, tree, search, file, thumbnail). Hidden patterns
only remove entries from list, tree, and search, but still allow direct file access by path.

Set these as environment variables (comma-separated):

- `EXCLUDED_PATTERNS`: entries to block across all endpoints (default: `.DS_Store,_h5ai`).
- `HIDDEN_PATTERNS`: entries to hide from list/tree/search only (default: `unlisted_`).

Patterns match any path segment that starts with the configured value, for example `unlisted` will
match `/folder-1/unlisted/file.jpg` and `/folder-2/unlisted_img.jpg`.

### Folder thumbnails

Folders show up to the first four thumbnails generated from the folder's images and videos by default. To define custom previews, add up to four images directly inside the folder named `folder_thumb_1.jpg` through `folder_thumb_4.jpg` (or `.png`). Custom thumbnails replace the default previews, are shown in numeric order, and remain hidden from directory listings and search results.

### Content warnings

Add a `content-warning.txt` file directly inside a folder to display a warning before that folder or its subfolders are opened. Warnings from the closest parent folder also apply to its subfolders. The acknowledgement is remembered in the current browser and can be cleared in Settings.

## Production build

1. Build the client:

```bash
cd client
npm install
npm run build
```

2. Start the server in production mode:

```bash
cd server
NODE_ENV=production npm start
```

The server will serve the static client from `client/dist`. You can override this with `CLIENT_DIST=/path/to/dist`.
To run workers in the same process for a single-container setup, use `node index.js combined`.

## Frontend configuration

Set these as Vite env variables (e.g., `client/.env.local` or your shell) and restart the dev server:

- `VITE_API_BASE`: Base URL for API requests (default: empty, same origin).
- `VITE_SHOW_STAGING`: Toggle the `STAGING` label in the header (`true`/`false`, default: `false`).
- `VITE_APP_COMMIT_SHORT`: Optional short commit id shown in the footer build label (in local dev it falls back to a placeholder).

## Server configuration

Optional environment variables:

- `SITE_ORIGIN`: Base origin for sitemap URLs (example: `https://archive.example.com`). If unset, the sitemap uses relative paths.

## Docker

Build the image and run it with your archive mounted (defaults to `combined` mode):

```bash
docker build -t mediaview .
docker run --rm -p 3001:3001 \
  -e ARCHIVE_ROOT=/archive \
  -e CACHE_ROOT=/cache \
  -v /absolute/path/to/archive:/archive:ro \
  -v /absolute/path/to/cache:/cache:rw \
  mediaview
```

The image includes `ffmpeg` for video thumbnail generation.

The Dockerfile uses multi-stage builds with Docker Hardened Images (DHI), copying only runtime artifacts into the final image.

### Worker sidecar

You can run the hash-cache and thumbnail workers in a separate container. The main
server watches the shared `file-hashes.json` for changes.

In this split setup, sitemap writes are handled by the `worker` process:

- `worker` and `combined` modes write/update `sitemap.xml`.
- `server` mode does not write sitemap files (read-only friendly).

```bash
docker run --rm -p 3001:3001 \
  -e ARCHIVE_ROOT=/archive \
  -e CACHE_ROOT=/cache \
  -v /absolute/path/to/archive:/archive:ro \
  -v /absolute/path/to/cache:/cache:rw \
  mediaview server

docker run --rm \
  -e ARCHIVE_ROOT=/archive \
  -e CACHE_ROOT=/cache \
  -v /absolute/path/to/archive:/archive:ro \
  -v /absolute/path/to/cache:/cache:rw \
  mediaview worker
```

Use `server` or `worker` to override the default `combined` mode.

## API

- `GET /api/list/<path>`: List a directory and one level of children.
- `GET /api/file/<path>`: Stream a file (supports Range + cache headers).
- `GET /api/thumbnail/<size>/<path>`: Get a thumbnail (`sm`, `md`, `lg`).
- `GET /api/tree`: Fetch the folder tree (structure only).
- `GET /api/hash-cache`: Hash cache status.
- `GET /api/health`: Health check.

## Notes

- `ARCHIVE_ROOT` defaults to `server/archive` if not set.
- `CACHE_ROOT` defaults to `.cache` under `ARCHIVE_ROOT`.
- The backend only allows access inside `ARCHIVE_ROOT`.
- Thumbnails and hashes are stored in `CACHE_ROOT`.
- Video thumbnail generation requires `ffmpeg` to additionally be installed and available on PATH.
- List, tree, and search responses are cached for 60 seconds; thumbnails are cached for 6 hours.
- In production, the Node server serves `client/dist` when available. Override with `CLIENT_DIST=/path/to/dist`.
