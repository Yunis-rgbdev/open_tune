# api/urls.py
from django.urls import path

from .views import (
    SongListCreateView,
    SongDetailView,
    UserLoginView,
    UserLogoutView,
    UserMeView,
    UserRegistrationView,
)

urlpatterns = [
    path('auth/register/', UserRegistrationView.as_view(), name='user-register'),
    path('auth/login/', UserLoginView.as_view(), name='user-login'),
    path('auth/logout/', UserLogoutView.as_view(), name='user-logout'),
    path('auth/me/', UserMeView.as_view(), name='user-me'),
    path('songs/', SongListCreateView.as_view(), name='song-list'),
    path('songs/<int:pk>/', SongDetailView.as_view(), name='song-detail'),
    path(' ', SongListCreateView.as_view(), name='song-list-create'),
]
