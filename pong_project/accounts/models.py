import secrets
import hashlib
from datetime import timedelta

from django.db import models
from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.utils import timezone
from django.core.exceptions import ValidationError

class CustomUser(AbstractUser):
    """
    Utilisateur personnalisé avec gestion de la 2FA, d'un avatar et du statut en ligne.
    """
    is_2fa_enabled = models.BooleanField(default=False)
    totp_secret = models.CharField(max_length=32, null=True, blank=True)
    friends = models.ManyToManyField('self', symmetrical=True, blank=True)
    avatar = models.ImageField(
        upload_to='avatars/',
        null=True,
        blank=True,
        default='avatars/default_avatar.png'
    )
    is_online = models.BooleanField(default=False)

    def clean(self):
        super().clean()
        if self.is_2fa_enabled and not self.totp_secret:
            raise ValidationError("Le secret TOTP ne peut pas être vide si la 2FA est activée.")

    def __str__(self):
        return self.username


class FriendRequest(models.Model):
    from_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='friend_requests_sent',
        on_delete=models.CASCADE
    )
    to_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='friend_requests_received',
        on_delete=models.CASCADE
    )
    timestamp = models.DateTimeField(auto_now_add=True)
    status = models.CharField(
        max_length=10,
        choices=[('pending', 'Pending'), ('accepted', 'Accepted'), ('rejected', 'Rejected')],
        default='pending'
    )

    def __str__(self):
        return f"{self.from_user} to {self.to_user} - {self.status}"


class TwoFactorCode(models.Model):
    """
    Code 2FA associé à un utilisateur.
    Le code est généré de manière sécurisée et expire après 10 minutes.
    """
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)

    @classmethod
    def generate_code(cls, user):
        # Supprime les anciens codes pour cet utilisateur
        cls.objects.filter(user=user).delete()
        # Génère un code à 6 chiffres, complété de zéros si nécessaire
        code = f"{secrets.randbelow(1000000):06d}"
        return cls.objects.create(user=user, code=code)

    def is_valid(self):
        return timezone.now() - self.created_at <= timedelta(minutes=10)

    def __str__(self):
        return f"TwoFactorCode(user={self.user}, code={self.code})"


class RefreshToken(models.Model):
    """
    Stocke le refresh token d'un utilisateur.
    Pour augmenter la sécurité, le token est stocké sous forme de hash SHA-256.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='refresh_tokens'
    )
    token = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_blacklisted = models.BooleanField(default=False)

    def set_token(self, raw_token):
        self.token = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()

    def check_token(self, raw_token):
        return self.token == hashlib.sha256(raw_token.encode('utf-8')).hexdigest()

    def is_expired(self):
        return timezone.now() > self.expires_at

    def is_valid(self):
        return not self.is_expired() and not self.is_blacklisted

    def __str__(self):
        return f"RefreshToken(user={self.user}, expires_at={self.expires_at})"
