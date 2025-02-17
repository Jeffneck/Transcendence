import logging
import hashlib

from django.views import View
from django.http import JsonResponse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from django.contrib.auth import logout
from django.utils.translation import gettext as _

from accounts.models import RefreshToken
from pong_project.decorators import login_required_json

logger = logging.getLogger(__name__)

@method_decorator(csrf_protect, name='dispatch')
@method_decorator(login_required_json, name='dispatch')
class LogoutView(View):
    """
    Vue pour gérer la déconnexion de l'utilisateur.
    """
    def post(self, request):
        raw_refresh_token = request.POST.get('refresh_token')
        if not raw_refresh_token:
            logger.warning("Aucun refresh token fourni lors de la déconnexion.")
            return JsonResponse({'error': _("Refresh token is required")}, status=400)
        
        # Calcul du hash SHA-256 du refresh token fourni
        hashed_refresh_token = hashlib.sha256(raw_refresh_token.encode('utf-8')).hexdigest()
        
        # Vérifier que le token appartient à l'utilisateur connecté
        token = RefreshToken.objects.filter(token=hashed_refresh_token, user=request.user).first()
        if not token:
            logger.warning("Refresh token invalide ou non associé à l'utilisateur %s.", request.user.username)
            return JsonResponse({'error': _("Invalid refresh token")}, status=401)
        
        try:
            token.delete()
            logout(request)
            logger.info("Utilisateur %s déconnecté avec succès.", request.user.username)
            return JsonResponse({'status': 'success', 'message': _('Déconnexion réussie.')})
        except Exception as e:
            logger.exception("Erreur lors de la déconnexion de l'utilisateur %s: %s", request.user.username, str(e))
            # Retourner un message générique pour ne pas divulguer d'informations sensibles
            return JsonResponse({'error': _("Une erreur interne est survenue. Veuillez réessayer plus tard.")}, status=500)
