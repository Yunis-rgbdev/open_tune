# api/serializers.py
from django.core.files.base import ContentFile
from django.contrib.auth import authenticate
from django.contrib.auth import get_user_model

from rest_framework import serializers

from .audio_metadata import (
    IMAGE_EXTENSIONS,
    extract_cover_art,
    extract_metadata,
    normalize_flac_pictures,
)
from .models import Song

User = get_user_model()


class SongSerializer(serializers.ModelSerializer):
    class Meta:
        model = Song
        fields = '__all__'

    def create(self, validated_data):
        song = super().create(validated_data)
        self._apply_file_metadata(song)
        return song

    def update(self, instance, validated_data):
        song = super().update(instance, validated_data)
        if 'audio_file' in validated_data:
            self._apply_file_metadata(
                song, replace_cover='audio_img' not in validated_data
            )
        return song

    @staticmethod
    def _apply_file_metadata(song, replace_cover=False):
        """Fill available song fields from the uploaded file's metadata."""
        file_field = song.audio_file
        if not file_field or not file_field.name:
            return
        try:
            path = file_field.path
        except (AttributeError, ValueError):
            return
        if not path:
            return
        normalize_flac_pictures(path)
        updates = []
        for field, value in extract_metadata(path).items():
            if not value:
                continue
            limit = Song._meta.get_field(field).max_length
            setattr(song, field, value[:limit])
            updates.append(field)

        cover = extract_cover_art(path)
        if cover and (replace_cover or not song.audio_img):
            image_data, mime = cover
            extension = IMAGE_EXTENSIONS[mime]
            song.audio_img.save(
                f'song-{song.pk}{extension}',
                ContentFile(image_data),
                save=False,
            )
            updates.append('audio_img')

        if not updates:
            return
        song.save(update_fields=updates)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'is_active', 'date_joined']


class UserRegistrationSerializer(serializers.ModelSerializer):
    password1 = serializers.CharField(style={'input_type': 'password'}, write_only=True)
    password2 = serializers.CharField(style={'input_type': 'password'}, write_only=True)

    class Meta:
        model = User
        fields = ['username', 'password1', 'password2']

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('A user with that username already exists.')
        return value

    def validate_password2(self, value):
        password1 = self.initial_data.get('password1', '')
        if not value or value != password1:
            raise serializers.ValidationError('Passwords do not match.')
        return value

    def create(self, validated_data):
        validated_data.pop('password2')
        password = validated_data.pop('password1')
        return User.objects.create_user(password=password, **validated_data)


class UserLoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(style={'input_type': 'password'})

    def validate(self, attrs):
        request = self.context.get('request')
        user = authenticate(
            request, username=attrs['username'], password=attrs['password']
        )
        if user is None:
            raise serializers.ValidationError('Invalid username or password.')
        attrs['user'] = user
        return attrs
