# pong_project/middleware.py

import logging
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from accounts.models import CustomUser
import jwt
from jwt.exceptions import ExpiredSignatureError, InvalidTokenError

logger = logging.getLogger(__name__)

class JWTAuthenticationMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        # Chemins à exclure du traitement JWT (exemple : connexion 2FA)
        self.exempt_paths = [
            '/accounts/2fa/login2fa/',
            # Ajouter d'autres URL si nécessaire.
        ]

    def __call__(self, request):
        # Si le chemin est exempté, on ne traite pas le JWT
        if any(request.path.startswith(exempt) for exempt in self.exempt_paths):
            return self.get_response(request)

        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
            try:
                payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
                user_id = payload.get('user_id')
                if not user_id:
                    logger.warning("Le payload JWT ne contient pas d'ID utilisateur.")
                    request.user = AnonymousUser()
                else:
                    try:
                        user = CustomUser.objects.get(id=user_id)
                    except CustomUser.DoesNotExist:
                        logger.debug("Utilisateur introuvable pour l'ID : %s", user_id)
                        user = AnonymousUser()
                    request.user = user
            except (ExpiredSignatureError, InvalidTokenError) as e:
                logger.warning("JWT invalide ou expiré : %s", e)
                request.user = AnonymousUser()
            except Exception as e:
                logger.error("Erreur inattendue lors du décodage du JWT : %s", e)
                request.user = AnonymousUser()
        else:
            logger.debug("Aucun jeton JWT fourni dans l'en-tête Authorization.")
            request.user = AnonymousUser()

        response = self.get_response(request)
        return response
