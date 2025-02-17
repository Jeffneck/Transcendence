import logging
from django.shortcuts import get_object_or_404
from django.http import JsonResponse
from django.template.loader import render_to_string
from django.views import View
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from game.models import GameSession, GameResult
from django.utils.translation import gettext as _

logger = logging.getLogger(__name__)

@method_decorator(csrf_protect, name='dispatch')
class GameResultsView(View):
    """
    Affiche les résultats d'une partie terminée.
    """
    def get(self, request, game_id, *args, **kwargs):
        try:
            session = get_object_or_404(GameSession, id=game_id)
            if session.status != 'finished':
                logger.error("Tentative d'accès aux résultats d'une session non terminée (%s).", game_id)
                return JsonResponse({'status': 'error', 'message': _("La session de jeu n'est pas terminée")}, status=401)
            results = get_object_or_404(GameResult, game=session)
            context = {
                'game_id': session.id,
                'winner': results.winner_local if results.winner_local else results.winner.username,
                'looser': results.looser_local if results.looser_local else results.looser.username,
                'score_left': results.score_left,
                'score_right': results.score_right,
            }
            html = render_to_string('game/game_results.html', context, request=request)
            return JsonResponse({
                'status': 'success',
                'html': html,
                **context
            }, status=200)
        except Exception as e:
            logger.exception("Erreur lors de la récupération des résultats pour la session %s : %s", game_id, e)
            return JsonResponse({'status': 'error', 'message': _("Une erreur est survenue lors de la récupération des résultats")}, status=500)
