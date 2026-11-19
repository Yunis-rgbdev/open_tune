# Open Tune

Open Tune is a self-hosted music library with a Next.js web app and a Django REST API. Upload audio files to build a library, read embedded tags and cover art with Mutagen, and play tracks in the browser.

## Features

- Upload audio files and extract available title, artist, album, genre, release date, and cover art.
- Browse a playlist, view track details, edit or delete songs, and play or seek through tracks.
- Register and authenticate users through the REST API.

## Stack

- Frontend: Next.js 16 and React 19
- Backend: Django 6.1 and Django REST Framework
- Database: PostgreSQL
- Audio tags: Mutagen

## Requirements

- Python 3.14 or newer
- [uv](https://docs.astral.sh/uv/)
- Node.js and npm
- PostgreSQL

## Development setup

### Backend

Create a PostgreSQL database and configure its connection with environment variables:

```sh
export OPENTUNE_DB_NAME=opentune
export OPENTUNE_DB_USER=postgres
export OPENTUNE_DB_PASSWORD=your-local-password
export OPENTUNE_DB_HOST=localhost
export OPENTUNE_DB_PORT=5432
createdb --username="$OPENTUNE_DB_USER" "$OPENTUNE_DB_NAME"
```

Install the Python dependencies, apply migrations, and start Django:

```sh
uv sync
uv run python manage.py migrate
uv run python manage.py runserver 8000
```

### Frontend

In another terminal:

```sh
cd frontend
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The frontend uses `http://localhost:8000` as its default API URL; set `NEXT_PUBLIC_API_BASE` to override it.

## API

- `GET` and `POST /api/songs/` — list and upload songs
- `GET`, `PATCH`, and `DELETE /api/songs/<id>/` — retrieve, edit, or delete a song
- `/api/auth/register/`, `/api/auth/login/`, `/api/auth/logout/`, and `/api/auth/me/` — authentication

## Validation

Run backend tests and the frontend production build with:

```sh
uv run python manage.py test
cd frontend && npm run build
```

## Local media and deployment

Uploaded audio and extracted cover images are stored under `media/`, which is intentionally excluded from Git. Back up this directory separately if you need to preserve uploaded tracks.

The Django development server serves local media files with byte-range support for browser playback. For production, configure secure Django settings, a production database, CORS, and media storage or a web server that supports byte-range requests. Do not use the Django development server in production.