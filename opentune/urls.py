"""
URL configuration for opentune project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
import mimetypes
import os
import re

from django.conf import settings
from django.contrib import admin
from django.core.exceptions import SuspiciousFileOperation
from django.http import FileResponse, Http404, HttpResponse, HttpResponseNotAllowed
from django.http.response import StreamingHttpResponse
from django.urls import include, path, re_path
from django.utils._os import safe_join
from django.utils.http import content_disposition_header

mimetypes.add_type('audio/flac', '.flac')


def serve_media(request, path, document_root):
    if request.method not in ('GET', 'HEAD'):
        return HttpResponseNotAllowed(['GET', 'HEAD'])

    try:
        file_path = safe_join(document_root, path)
    except SuspiciousFileOperation as error:
        raise Http404 from error
    if not os.path.isfile(file_path):
        raise Http404

    file_size = os.path.getsize(file_path)
    content_type = mimetypes.guess_type(file_path)[0] or 'application/octet-stream'
    range_header = request.headers.get('Range')
    if not range_header:
        response = FileResponse(
            open(file_path, 'rb'),
            content_type=content_type,
            filename=os.path.basename(file_path),
        )
        response['Accept-Ranges'] = 'bytes'
        return response

    match = re.fullmatch(r'bytes=(\d*)-(\d*)', range_header.strip())
    if not match or file_size == 0:
        return _range_not_satisfiable(file_size)

    first, last = match.groups()
    try:
        if first:
            start = int(first)
            end = min(int(last), file_size - 1) if last else file_size - 1
            if start >= file_size or end < start:
                return _range_not_satisfiable(file_size)
        else:
            suffix_length = int(last) if last else 0
            if suffix_length == 0:
                return _range_not_satisfiable(file_size)
            start = max(file_size - suffix_length, 0)
            end = file_size - 1
    except ValueError:
        return _range_not_satisfiable(file_size)

    length = end - start + 1

    def stream_range():
        with open(file_path, 'rb') as media_file:
            media_file.seek(start)
            remaining = length
            while remaining:
                chunk = media_file.read(min(64 * 1024, remaining))
                if not chunk:
                    break
                remaining -= len(chunk)
                yield chunk

    response = StreamingHttpResponse(
        stream_range() if request.method == 'GET' else (),
        status=206,
        content_type=content_type,
    )
    response['Accept-Ranges'] = 'bytes'
    response['Content-Range'] = f'bytes {start}-{end}/{file_size}'
    response['Content-Length'] = str(length)
    response['Content-Disposition'] = content_disposition_header(
        False, os.path.basename(file_path)
    )
    return response


def _range_not_satisfiable(file_size):
    response = HttpResponse(status=416)
    response['Accept-Ranges'] = 'bytes'
    response['Content-Range'] = f'bytes */{file_size}'
    return response


urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('opentune_app.urls')),
    path('api/', include('api.urls')),
]

# Serve uploaded media files during development.
if settings.DEBUG and settings.MEDIA_URL.startswith('/'):
    urlpatterns += [
        re_path(
            r'^%s(?P<path>.*)$' % re.escape(settings.MEDIA_URL.lstrip('/')),
            serve_media,
            {'document_root': settings.MEDIA_ROOT},
            name='media',
        )
    ]
