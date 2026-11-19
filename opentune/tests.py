from tempfile import TemporaryDirectory
from pathlib import Path

from django.http import Http404
from django.test import RequestFactory, SimpleTestCase

from .urls import serve_media


class MediaServingTests(SimpleTestCase):
    def test_flac_range_request_returns_partial_audio_response(self):
        with TemporaryDirectory() as media_root:
            Path(media_root, 'track.flac').write_bytes(b'abcdefghij')
            request = RequestFactory().get(
                '/media/track.flac', HTTP_RANGE='bytes=2-5'
            )

            response = serve_media(request, 'track.flac', media_root)

            self.assertEqual(response.status_code, 206)
            self.assertEqual(response['Content-Type'], 'audio/flac')
            self.assertEqual(response['Content-Range'], 'bytes 2-5/10')
            self.assertEqual(response['Content-Length'], '4')
            self.assertEqual(b''.join(response.streaming_content), b'cdef')

    def test_media_path_cannot_escape_media_root(self):
        with TemporaryDirectory() as media_root:
            request = RequestFactory().get('/media/../settings.py')

            with self.assertRaises(Http404):
                serve_media(request, '../settings.py', media_root)
