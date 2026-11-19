from rest_framework import generics, status

from django.contrib.auth import authenticate

from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Song
from .serializers import (
    SongSerializer,
    UserLoginSerializer,
    UserRegistrationSerializer,
    UserSerializer,
)


# Create your views here.
# api/views.py


class SongListCreateView(generics.ListCreateAPIView):
    queryset = Song.objects.all()
    serializer_class = SongSerializer

class SongDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Song.objects.all()
    serializer_class = SongSerializer


class UserRegistrationView(APIView):
    """Create a new user and return an authentication token for it."""

    def post(self, request):
        serializer = UserRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {'token': token.key, 'user': UserSerializer(user).data},
            status=status.HTTP_201_CREATED,
        )


class UserLoginView(APIView):
    """Authenticate an existing user and return an authentication token."""

    def post(self, request):
        serializer = UserLoginSerializer(
            data=request.data, context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        token, _ = Token.objects.get_or_create(user=user)
        return Response({'token': token.key, 'user': UserSerializer(user).data})


class UserLogoutView(APIView):
    """Revoke the authentication token of the requesting user."""

    def post(self, request):
        if request.user.is_authenticated:
            Token.objects.filter(user=request.user).delete()
        return Response({'detail': 'Successfully logged out.'})


class UserMeView(APIView):
    """Return the details of the authenticated user."""

    def get(self, request):
        if not request.user.is_authenticated:
            return Response(
                {'detail': 'Authentication credentials were not provided.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        return Response(UserSerializer(request.user).data)
