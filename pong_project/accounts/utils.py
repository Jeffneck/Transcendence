# accounts/utils.py

import hashlib
from datetime import timedelta
import jwt
from django.conf import settings
from django.utils import timezone
from .models import RefreshToken

def generate_jwt_token(user, include_refresh=True):
    """
    Génère un Access Token et, si demandé, un Refresh Token pour l'utilisateur.
    """
    current_time = timezone.now()
    
    # Payload de l'Access Token (valide 1 heure)
    access_payload = {
        'user_id': user.id,
        'username': user.username,
        'exp': current_time + timedelta(hours=1),
    }
    access_token = jwt.encode(access_payload, settings.SECRET_KEY, algorithm='HS256')
    if isinstance(access_token, bytes):
        access_token = access_token.decode('utf-8')
    
    tokens = {'access_token': access_token}
    
    if include_refresh:
        # Payload du Refresh Token (valide 7 jours)
        refresh_payload = {
            'user_id': user.id,
            'username': user.username,
            'exp': current_time + timedelta(days=7),
        }
        refresh_token = jwt.encode(refresh_payload, settings.SECRET_KEY, algorithm='HS256')
        if isinstance(refresh_token, bytes):
            refresh_token = refresh_token.decode('utf-8')
        
        refresh_expires_at = current_time + timedelta(days=7)
        # Calcul du hash SHA-256 du refresh token
        hashed_token = hashlib.sha256(refresh_token.encode('utf-8')).hexdigest()
        # Stockage en base du refresh token (sous forme de hash)
        RefreshToken.objects.create(
            user=user,
            token=hashed_token,
            expires_at=refresh_expires_at
        )
        tokens['refresh_token'] = refresh_token
    
    return tokens
