# accounts/views/tokenManagement.py

import hashlib
import logging
import jwt
from jwt.exceptions import ExpiredSignatureError, InvalidTokenError
from datetime import timedelta
from django.views import View
from django.http import JsonResponse
from django.conf import settings
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from accounts.models import RefreshToken, CustomUser
from accounts.utils import generate_jwt_token
from pong_project.decorators import login_required_json
from django.utils.translation import gettext as _

logger = logging.getLogger(__name__)

@method_decorator(csrf_protect, name='dispatch')
@method_decorator(login_required_json, name='dispatch')
class RefreshJwtView(View):
    """
    Vue permettant de rafraîchir l'access token en utilisant le refresh token.
    Elle vérifie que le refresh token est valide et non blacklisté,
    puis le marque comme utilisé (blacklisté) et délivre un nouveau access token.
    """
    def post(self, request):
        try:
            refresh_token = request.POST.get('refresh_token')
            if not refresh_token:
                logger.warning("Aucun refresh token fourni dans la requête.")
                return JsonResponse({'error': _('Le refresh token est requis.')}, status=400)
            
            # Décodage du refresh token avec vérification de sa signature et de son expiration
            try:
                payload = jwt.decode(refresh_token, settings.SECRET_KEY, algorithms=['HS256'])
            except ExpiredSignatureError:
                logger.warning("Refresh token expiré.")
                return JsonResponse({'error': _('Refresh token expiré.'), 'error_code': 'token-error'}, status=401)
            except InvalidTokenError:
                logger.warning("Refresh token invalide.")
                return JsonResponse({'error': _('Refresh token invalide.'), 'error_code': 'token-error'}, status=401)
            
            # Calcul du hash SHA-256 du refresh token fourni
            hashed_token = hashlib.sha256(refresh_token.encode('utf-8')).hexdigest()
            
            # Vérification dans la base : le token doit exister, ne pas être expiré et ne pas être blacklisté
            token_obj = RefreshToken.objects.filter(token=hashed_token, is_blacklisted=False).first()
            if not token_obj or not token_obj.is_valid():
                logger.warning("Refresh token invalide ou expiré dans la base de données.")
                return JsonResponse({'error': _('Refresh token invalide ou expiré.'), 'error_code': 'token-error'}, status=401)
            
            # Blacklist le refresh token pour empêcher sa réutilisation
            token_obj.is_blacklisted = True
            token_obj.save(update_fields=['is_blacklisted'])
            
            # Récupère l'utilisateur depuis le payload
            user_id = payload.get('user_id')
            user = CustomUser.objects.filter(id=user_id).first()
            if not user:
                logger.warning(f"Utilisateur non trouvé pour l'ID {user_id}.")
                return JsonResponse({'error': _('Utilisateur non trouvé.')}, status=404)
            
            # Génère un nouveau access token sans créer de nouveau refresh token
            new_access_token = generate_jwt_token(user, include_refresh=False)['access_token']
            return JsonResponse({'access_token': new_access_token}, status=200)
        except Exception as e:
            logger.exception("Erreur inattendue lors du rafraîchissement du token: %s", e)
            return JsonResponse({'error': _('Une erreur inattendue est survenue.')}, status=500)
