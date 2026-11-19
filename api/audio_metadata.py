"""Extract song metadata from embedded audio tags.

Reads common Mutagen tags across MP3, OGG, FLAC, MP4 and WAV files. Only fields
present in the file are returned; release dates are normalized to ISO format.
"""

import base64
import binascii
import re
from datetime import date

from mutagen import File
from mutagen.flac import FLAC, Picture

# Tag keys to try per field, across the formats mutagen can read.
_TAG_KEYS = {
    'title': ('TIT2', 'title'),
    'artist': ('TPE1', 'artist'),
    'album': ('TALB', 'album'),
    'genre': ('TCON', 'genre'),
    'release_date': (
        'TDRC',
        'TYER',
        'TDOR',
        'date',
        'DATE',
        'year',
        'YEAR',
        'originaldate',
        'ORIGINALDATE',
        '©day',
    ),
}


def extract_metadata(path):
    """Return available song fields read from the audio file's tags."""
    try:
        audio = File(path)
    except Exception:
        return {}
    if audio is None:
        return {}
    tags = getattr(audio, 'tags', None) or {}
    metadata = {}
    for field, keys in _TAG_KEYS.items():
        for key in keys:
            text = _tag_text(tags, key)
            if text:
                if field == 'release_date':
                    text = _normalize_date(text)
                    if not text:
                        continue
                metadata[field] = text
                break
    return metadata


def normalize_flac_pictures(path):
    """Repair or remove FLAC pictures with missing MIME types."""
    audio = File(path)
    if not isinstance(audio, FLAC):
        return

    pictures = audio.pictures
    valid_pictures = []
    changed = False
    for picture in pictures:
        if picture.mime:
            valid_pictures.append(picture)
            continue
        picture.mime = _image_mime(picture.data)
        changed = True
        if picture.mime:
            valid_pictures.append(picture)

    if not changed:
        return
    audio.clear_pictures()
    for picture in valid_pictures:
        audio.add_picture(picture)
    audio.save()


def extract_cover_art(path):
    """Return the first supported embedded image as (bytes, MIME type)."""
    try:
        audio = File(path)
    except Exception:
        return None
    if audio is None:
        return None

    for picture in getattr(audio, 'pictures', ()):
        cover = _cover_data(picture.data, picture.mime)
        if cover:
            return cover

    tags = getattr(audio, 'tags', None) or {}
    getall = getattr(tags, 'getall', None)
    if getall:
        for picture in getall('APIC'):
            cover = _cover_data(picture.data, picture.mime)
            if cover:
                return cover

    for picture in tags.get('covr', ()):
        cover = _cover_data(picture, '')
        if cover:
            return cover

    for key in ('metadata_block_picture', 'METADATA_BLOCK_PICTURE'):
        for encoded in _tag_values(tags.get(key)):
            try:
                picture = Picture(base64.b64decode(encoded))
            except (binascii.Error, ValueError):
                continue
            cover = _cover_data(picture.data, picture.mime)
            if cover:
                return cover

    return None


def _cover_data(data, mime):
    data = bytes(data)
    mime = _image_mime(data) or mime.lower()
    if mime not in IMAGE_EXTENSIONS:
        return None
    return data, mime


def _tag_values(value):
    if value is None:
        return ()
    if isinstance(value, (list, tuple)):
        return value
    return (value,)


def _normalize_date(value):
    match = re.match(r'^\s*(\d{4})(?:[-/.]?(\d{2})(?:[-/.]?(\d{2}))?)?', value)
    if not match:
        return ''
    year, month, day = (int(part) if part else 1 for part in match.groups())
    try:
        return date(year, month, day).isoformat()
    except ValueError:
        return ''


def _image_mime(data):
    if data.startswith(b'\xff\xd8\xff'):
        return 'image/jpeg'
    if data.startswith(b'\x89PNG\r\n\x1a\n'):
        return 'image/png'
    if data.startswith((b'GIF87a', b'GIF89a')):
        return 'image/gif'
    if data.startswith(b'RIFF') and data[8:12] == b'WEBP':
        return 'image/webp'
    if data.startswith(b'BM'):
        return 'image/bmp'
    if data.startswith((b'II*\x00', b'MM\x00*')):
        return 'image/tiff'
    return ''


IMAGE_EXTENSIONS = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/bmp': '.bmp',
    'image/tiff': '.tif',
}


def _tag_text(tags, key):
    """Best-effort read of one tag as a string, or '' when absent."""
    value = None
    try:
        value = tags.get(key)
    except AttributeError:
        try:
            value = tags[key]
        except (KeyError, IndexError, TypeError):
            return ''
    return _to_text(value)


def _to_text(value):
    """Flatten a tag value (frame, list, or plain string) to a clean string."""
    if value is None:
        return ''
    if hasattr(value, 'text'):  # ID3 frames carry their strings in .text
        value = value.text
    if isinstance(value, (list, tuple, set)):
        parts = [_to_text(item).strip() for item in value]
        return ' '.join(part for part in parts if part).strip()
    return str(value).strip()
