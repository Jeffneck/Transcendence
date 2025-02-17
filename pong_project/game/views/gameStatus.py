import logging
from django.views import View
from django.http import JsonResponse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from game.models import GameSession
from django.utils.translation import gettext as _
from pong_project.decorators import login_required_json
from django.shortcuts import get_object_or_404


logger = logging.getLogger(__name__)

@method_decorator(csrf_protect, name='dispatch')
@method_decorator(login_required_json, name='dispatch')
class GetGameStatusView(View):
    def get(self, request, game_id, *args, **kwargs):
        try:
            session = get_object_or_404(GameSession, id=game_id)
            return JsonResponse({
                'status': 'success',
                'session_status': session.status
            }, status=200)
        except Exception as e:
            logger.exception("Erreur lors de la récupération du status de la session %s : %s", game_id, e)
            return JsonResponse({'status': 'error', 'message': _("Erreur interne du serveur")}, status=500)
