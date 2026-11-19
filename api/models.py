from django.db import models

# Create your models here.
# api/models.py
class Song(models.Model):
    id = models.AutoField(primary_key=True)
    title = models.CharField(max_length=100, blank=True)
    categorie = models.CharField(max_length=100, null=True, default=None)
    artist = models.CharField(max_length=100, blank=True)
    album = models.CharField(max_length=100, blank=True)
    release_date = models.DateField(blank=True, null=True)
    genre = models.CharField(max_length=50, blank=True)
    audio_file = models.FileField(upload_to='audio/')
    audio_img = models.FileField(upload_to='audio_img/', blank=True)

    def __str__(self):
        return f"{self.title} by {self.artist}"