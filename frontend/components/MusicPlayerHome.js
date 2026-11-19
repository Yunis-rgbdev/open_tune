'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

// The edit form uses this field shape.
const EMPTY_FORM = {
  title: '',
  artist: '',
  album: '',
  genre: '',
  release_date: '',
  categorie: '',
  audioFile: null,
  audioImg: null,
};

const ICONS = {
  upload: (
    <>
      <path d="M12 16V4m0 0L7 9m5-5 5 5" />
      <path d="M5 15v4h14v-4" />
    </>
  ),
  music: (
    <>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
      <path d="m9 9 12-2" />
    </>
  ),
  play: <path d="M8 5.5v13l10-6.5z" fill="currentColor" stroke="none" />,
  pause: (
    <>
      <path d="M8 5h3v14H8zM15 5h3v14h-3z" fill="currentColor" stroke="none" />
    </>
  ),
  edit: (
    <>
      <path d="m14 5 5 5" />
      <path d="M4 20h4l11-11a2.1 2.1 0 0 0-4-4L4 16v4Z" />
    </>
  ),
  delete: (
    <>
      <path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </>
  ),
};

const GLASS_BACKDROP = { backdropFilter: 'blur(22px) saturate(145%)' };

function Icon({ name, size = 18, className = '' }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICONS[name]}
    </svg>
  );
}

function apiErrorMessage(data, fallback) {
  if (!data) return fallback;
  if (typeof data.detail === 'string') return data.detail;
  if (Array.isArray(data.non_field_errors) && data.non_field_errors.length) {
    return data.non_field_errors.join(' ');
  }
  const messages = Object.entries(data)
    .flatMap(([, value]) => (Array.isArray(value) ? value : [value]))
    .filter((value) => typeof value === 'string' && value.length > 0)
    .map(String);
  return messages.length ? messages.join(' ') : fallback;
}

function mediaUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

function formatDate(value) {
  if (!value) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (!match) return String(value);
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDuration(seconds) {
  if (!seconds || Number.isNaN(seconds)) return '0:00';
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export default function MusicPlayerHome() {
  const audioRef = useRef(null);

  const [songs, setSongs] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [submittingUpload, setSubmittingUpload] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const [deletingId, setDeletingId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingId, setPlayingId] = useState(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const loadSongs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/songs/`);
      const data = await response.json().catch(() => null);
      const nextSongs = response.ok && Array.isArray(data) ? data : [];
      setSongs(nextSongs);
      setSelectedId((current) =>
        nextSongs.some((song) => song.id === current)
          ? current
          : nextSongs[0]?.id ?? null
      );
    } catch {
      setSongs([]);
      setError(`Could not reach the backend on ${API_BASE}. Is it running?`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSongs();
  }, [loadSongs]);

  useEffect(() => {
    if (!playingId) return;
    if (!songs.some((song) => song.id === playingId)) {
      if (audioRef.current) audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [songs, playingId]);

  const setEditField = useCallback((field, value) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  function appendFormData(data, form) {
    data.append('title', form.title.trim());
    data.append('artist', form.artist.trim());
    data.append('album', form.album.trim());
    data.append('genre', form.genre.trim());
    if (form.release_date) data.append('release_date', form.release_date);
    if (form.categorie) data.append('categorie', form.categorie);
    if (form.audioFile) data.append('audio_file', form.audioFile);
    if (form.audioImg) data.append('audio_img', form.audioImg);
  }

  function requestSong(method, url, form) {
    const data = new FormData();
    appendFormData(data, form);
    return fetch(url, { method, body: data });
  }

  function openEditor(song) {
    setUploading(false);
    setEditing(true);
    setEditForm({
      id: song.id,
      title: song.title ?? '',
      artist: song.artist ?? '',
      album: song.album ?? '',
      genre: song.genre ?? '',
      release_date: song.release_date ?? '',
      categorie: song.categorie ?? '',
      audioFile: null,
      audioImg: null,
    });
  }

  function closeEditor() {
    setEditing(false);
    setEditForm(EMPTY_FORM);
  }

  async function handleEditSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const response = await requestSong(
        'PATCH',
        `${API_BASE}/api/songs/${editForm.id}/`,
        editForm
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(apiErrorMessage(result, 'Could not save the changes.'));
        return;
      }
      closeEditor();
      await loadSongs();
    } catch {
      setError(`Could not reach the backend on ${API_BASE}. Is it running?`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUploadSubmit(event) {
    event.preventDefault();
    if (!uploadFile) {
      setError('Choose an audio file to upload.');
      return;
    }
    setSubmittingUpload(true);
    setError('');
    try {
      const data = new FormData();
      data.append('audio_file', uploadFile);
      const response = await fetch(`${API_BASE}/api/songs/`, {
        method: 'POST',
        body: data,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(apiErrorMessage(result, 'Could not upload the song.'));
        return;
      }
      setUploading(false);
      setUploadFile(null);
      await loadSongs();
      setSelectedId(result.id);
    } catch {
      setError(`Could not reach the backend on ${API_BASE}. Is it running?`);
    } finally {
      setSubmittingUpload(false);
    }
  }

  async function handleDelete(song) {
    if (!window.confirm(`Delete "${song.title}"?`)) return;
    setDeletingId(song.id);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/api/songs/${song.id}/`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        setError(apiErrorMessage(result, 'Could not delete the song.'));
        return;
      }
      await loadSongs();
    } catch {
      setError(`Could not reach the backend on ${API_BASE}. Is it running?`);
    } finally {
      setDeletingId(null);
    }
  }

  function playSong(song) {
    const url = mediaUrl(song?.audio_file);
    if (!url) return;
    const audio = audioRef.current;
    if (!audio) return;
    setSelectedId(song.id);
    if (playingId === song.id && isPlaying) {
      audio.pause();
      return;
    }
    setPlayingId(song.id);
    if (audio.src !== url) audio.src = url;
    setIsPlaying(false);
    setError('');
    audio.play().catch(() => {
      setIsPlaying(false);
      setError(
        `Could not play "${song.title}". Check that the audio file is supported and available.`
      );
    });
  }

  function handleSeek(event) {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const percent = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    audio.currentTime = percent * audio.duration;
  }

  const playingSong = songs.find((song) => song.id === playingId) || null;
  const selectedSong =
    songs.find((song) => song.id === selectedId) || playingSong || null;
  const progressPercent = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;

  return (
    <>
      <div className="home-heading">
        <div>
          <h1>Welcome to Open Tune</h1>
          <p className="page-subtitle">Your music, all in one place.</p>
        </div>
        <button
          type="button"
          className="upload-trigger"
          onClick={() => {
            setUploadFile(null);
            setUploading((open) => !open);
            setEditing(false);
          }}
          disabled={submittingUpload}
        >
          <Icon name="upload" size={17} />
          <span>{uploading ? 'Close upload' : 'Upload music'}</span>
        </button>
      </div>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}

      <div className="home-layout">
        <aside className="playlist-panel" style={GLASS_BACKDROP}>
          <div className="list-header">
            <h2>Your playlist</h2>
            <span className="list-count">
              {songs.length} song{songs.length === 1 ? '' : 's'}
            </span>
          </div>
          <ul className="song-list">
            {loading ? (
              <li className="song-list-empty">Loading songs…</li>
            ) : songs.length === 0 ? (
              <li className="song-list-empty">No songs yet.</li>
            ) : (
              songs.map((song) => (
                <li
                  className={`playlist-item${selectedId === song.id ? ' is-selected' : ''}`}
                  key={song.id}
                >
                  <button
                    type="button"
                    className="playlist-select"
                    onClick={() => setSelectedId(song.id)}
                    aria-current={selectedId === song.id ? 'true' : undefined}
                  >
                    {song.audio_img ? (
                      <img
                        className="song-cover"
                        src={mediaUrl(song.audio_img)}
                        alt=""
                      />
                    ) : (
                      <span className="song-cover song-cover--placeholder">
                        <Icon name="music" size={20} />
                      </span>
                    )}
                    <span className="song-info">
                      <span className="song-title">{song.title}</span>
                      <span className="song-meta">{song.artist}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="playlist-play"
                    onClick={() => playSong(song)}
                    aria-label={`${playingId === song.id && isPlaying ? 'Pause' : 'Play'} ${song.title}`}
                  >
                    <Icon
                      name={playingId === song.id && isPlaying ? 'pause' : 'play'}
                      size={16}
                    />
                  </button>
                </li>
              ))
            )}
          </ul>
        </aside>

        <section className="song-details" style={GLASS_BACKDROP}>
          {uploading ? (
            <div className="upload-panel" style={GLASS_BACKDROP}>
              <h2>Upload music</h2>
              <form className="song-form" onSubmit={handleUploadSubmit}>
                <label>
                  Audio file
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(event) => setUploadFile(event.target.files[0] || null)}
                    required
                  />
                </label>
                <div className="form-actions">
                  <button type="submit" disabled={submittingUpload}>
                    {submittingUpload ? 'Uploading…' : 'Upload song'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUploadFile(null);
                      setUploading(false);
                    }}
                    disabled={submittingUpload}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          ) : selectedSong ? (
            <div className="detail-content">
              <div className="detail-cover-wrap">
                {selectedSong.audio_img ? (
                  <img
                    className="detail-cover"
                    src={mediaUrl(selectedSong.audio_img)}
                    alt={`${selectedSong.title} cover`}
                  />
                ) : (
                <div className="detail-cover detail-cover--placeholder">
                  <Icon name="music" size={68} />
                </div>
                )}
              </div>
              <p className="detail-eyebrow">NOW IN YOUR LIBRARY</p>
              <h2 className="detail-title">{selectedSong.title}</h2>
              <p className="detail-artist">{selectedSong.artist}</p>
              <p className="detail-meta">
                {[selectedSong.album, selectedSong.categorie, selectedSong.genre]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <p className="detail-date">Released {formatDate(selectedSong.release_date)}</p>
              <div className="detail-actions">
                <button
                  type="button"
                  className="detail-play"
                  onClick={() => playSong(selectedSong)}
                >
                  <Icon
                    name={playingId === selectedSong.id && isPlaying ? 'pause' : 'play'}
                    size={16}
                  />
                  <span>
                    {playingId === selectedSong.id && isPlaying ? 'Pause' : 'Play song'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => openEditor(selectedSong)}
                  disabled={submitting}
                >
                  <Icon name="edit" size={16} />
                  Edit details
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(selectedSong)}
                  disabled={deletingId === selectedSong.id}
                >
                  <Icon name="delete" size={16} />
                  {deletingId === selectedSong.id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          ) : (
            <div className="detail-empty">
              <span className="detail-empty-icon">
                <Icon name="music" size={42} />
              </span>
              <h2>Your music starts here</h2>
              <p>Upload a song to start building your library.</p>
              <button
                type="button"
                className="upload-trigger"
                onClick={() => setUploading(true)}
              >
                <Icon name="upload" size={17} />
                <span>Upload music</span>
              </button>
            </div>
          )}
        </section>
      </div>

      {editing && (
        <section className="upload-panel">
          <h2>Edit song</h2>
          <form className="song-form" onSubmit={handleEditSubmit}>
            <div className="form-row">
              <label className="label-half">
                Title
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(event) => setEditField('title', event.target.value)}
                  required
                />
              </label>
              <label className="label-half">
                Artist
                <input
                  type="text"
                  value={editForm.artist}
                  onChange={(event) => setEditField('artist', event.target.value)}
                  required
                />
              </label>
            </div>
            <div className="form-row">
              <label className="label-half">
                Album
                <input
                  type="text"
                  value={editForm.album}
                  onChange={(event) => setEditField('album', event.target.value)}
                  required
                />
              </label>
              <label className="label-half">
                Genre
                <input
                  type="text"
                  value={editForm.genre}
                  onChange={(event) => setEditField('genre', event.target.value)}
                  required
                />
              </label>
            </div>
            <label>
              Release date
              <input
                type="date"
                value={editForm.release_date}
                onChange={(event) =>
                  setEditField('release_date', event.target.value)
                }
                required
              />
            </label>
            <label>
              Category
              <input
                type="text"
                value={editForm.categorie}
                onChange={(event) => setEditField('categorie', event.target.value)}
              />
            </label>
            <label>
              Audio file (leave blank to keep the current one)
              <input
                type="file"
                accept="audio/*"
                onChange={(event) =>
                  setEditField('audioFile', event.target.files[0] || null)
                }
              />
            </label>
            <label>
              Cover image (leave blank to keep the current one)
              <input
                type="file"
                accept="image/*"
                onChange={(event) =>
                  setEditField('audioImg', event.target.files[0] || null)
                }
              />
            </label>
            <div className="form-actions">
              <button type="submit" disabled={submitting}>
                Save changes
              </button>
              <button
                type="button"
                onClick={closeEditor}
                disabled={submitting}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      <audio
        ref={audioRef}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) =>
          setCurrentTime(event.currentTarget.currentTime || 0)
        }
      />

      {playingSong && (
        <div className="player-bar" style={GLASS_BACKDROP}>
          <button
            type="button"
            className="song-cover-btn"
            onClick={() => playSong(playingSong)}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {playingSong.audio_img ? (
              <img
                className="player-cover"
                src={mediaUrl(playingSong.audio_img)}
                alt=""
              />
            ) : (
              <span className="player-cover player-cover--placeholder">
                <Icon name="music" size={20} />
              </span>
            )}
          </button>
          <div className="player-info">
            <div className="player-title">{playingSong.title}</div>
            <div className="player-meta">
              {playingSong.artist}
              {playingSong.album ? ` — ${playingSong.album}` : ''}
            </div>
          </div>
          <button
            type="button"
            className="player-main"
            onClick={() => playSong(playingSong)}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            <Icon name={isPlaying ? 'pause' : 'play'} size={19} />
          </button>
          <span className="player-time">
            {formatDuration(currentTime)} / {formatDuration(duration)}
          </span>
          <div
            className="player-progress"
            onClick={handleSeek}
            role="slider"
            aria-label="Playback position"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(currentTime)}
            tabIndex={0}
          >
            <div className="player-progress-track">
              <div
                className="player-progress-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
