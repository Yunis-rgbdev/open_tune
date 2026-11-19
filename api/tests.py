from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase

from .audio_metadata import (
    extract_cover_art,
    extract_metadata,
    normalize_flac_pictures,
)
from .serializers import SongSerializer


class AudioMetadataTests(SimpleTestCase):
    @patch('api.audio_metadata.File')
    def test_extracts_song_metadata_and_normalizes_release_date(self, mutagen_file):
        mutagen_file.return_value = SimpleNamespace(
            tags={
                'TIT2': 'Song title',
                'TPE1': 'Song artist',
                'TALB': 'Song album',
                'TCON': 'Jazz',
                'TDRC': '2024',
            }
        )

        self.assertEqual(
            extract_metadata('song.mp3'),
            {
                'title': 'Song title',
                'artist': 'Song artist',
                'album': 'Song album',
                'genre': 'Jazz',
                'release_date': '2024-01-01',
            },
        )

    def test_song_serializer_accepts_audio_file_without_other_fields(self):
        serializer = SongSerializer(
            data={
                'audio_file': SimpleUploadedFile(
                    'song.mp3', b'audio data', content_type='audio/mpeg'
                )
            }
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_repairs_missing_mime_on_embedded_jpeg(self):
        picture = SimpleNamespace(mime='', data=b'\xff\xd8\xffjpeg-data')

        class FakeFlac:
            def __init__(self):
                self.pictures = [picture]
                self.saved = False

            def clear_pictures(self):
                self.pictures.clear()

            def add_picture(self, value):
                self.pictures.append(value)

            def save(self):
                self.saved = True

        audio = FakeFlac()
        with patch('api.audio_metadata.FLAC', FakeFlac):
            with patch('api.audio_metadata.File', return_value=audio):
                normalize_flac_pictures('song.flac')

        self.assertEqual(picture.mime, 'image/jpeg')
        self.assertTrue(audio.saved)

    @patch('api.audio_metadata.File')
    def test_extracts_embedded_jpeg_cover(self, mutagen_file):
        image_data = b'\xff\xd8\xffjpeg-data'
        picture = SimpleNamespace(data=image_data, mime='')
        mutagen_file.return_value = SimpleNamespace(
            pictures=[picture],
            tags={},
        )

        self.assertEqual(
            extract_cover_art('song.flac'),
            (image_data, 'image/jpeg'),
        )

    @patch('api.serializers.normalize_flac_pictures')
    @patch('api.serializers.extract_metadata', return_value={})
    @patch(
        'api.serializers.extract_cover_art',
        return_value=(b'\xff\xd8\xffjpeg-data', 'image/jpeg'),
    )
    def test_serializer_saves_embedded_cover_to_song_image(
        self, extract_cover, extract_metadata, normalize_pictures
    ):
        class FakeImageField:
            name = ''

            def save(self, name, content, save):
                self.name = f'audio_img/{name}'
                self.content = content.read()

            def __bool__(self):
                return bool(self.name)

        song = SimpleNamespace(
            pk=42,
            audio_file=SimpleNamespace(name='audio/song.flac', path='/tmp/song.flac'),
            audio_img=FakeImageField(),
            save=Mock(),
        )

        SongSerializer._apply_file_metadata(song)

        self.assertEqual(song.audio_img.name, 'audio_img/song-42.jpg')
        self.assertEqual(song.audio_img.content, b'\xff\xd8\xffjpeg-data')
        song.save.assert_called_once_with(update_fields=['audio_img'])
