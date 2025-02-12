import logging
from django.views import View
from django.http import JsonResponse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from django.template.loader import render_to_string
from django.db.models import Max
from django.contrib.auth import get_user_model
from pong_project.decorators import login_required_json
from django.utils.translation import gettext as _

from game.models import GameResult

logger = logging.getLogger(__name__)
User = get_user_model()

@method_decorator(csrf_protect, name='dispatch')
@method_decorator(login_required_json, name='dispatch')
class ProfileView(View):
    """
    Vue pour afficher le profil utilisateur avec statistiques et historique des matchs.
    """
    def get(self, request):
        try:
            user = request.user
            # Récupération de l'historique des matchs via le manager personnalisé
            matches = GameResult.objects.get_user_match_history(user)
            match_count = matches.count()
            victories = matches.filter(winner=user).count()
            defeats = matches.filter(looser=user).count()  # Remarque : le champ est "looser" dans le modèle

            # Calcul du meilleur score (en considérant les scores pour les joueurs de gauche et de droite)
            best_score_left = matches.filter(game__player_left=user).aggregate(Max('score_left'))['score_left__max'] or 0
            best_score_right = matches.filter(game__player_right=user).aggregate(Max('score_right'))['score_right__max'] or 0
            best_score = max(best_score_left, best_score_right)

            friends_count = user.friends.count()

            # Construction de l'historique des matchs
            match_histories = []
            for match in matches:
                opponent = match.game.player_right if match.game.player_left == user else match.game.player_left
                match_histories.append({
                    'opponent': opponent.username,  # Récupération du nom d'utilisateur de l'adversaire
                    'result': 'win' if match.winner == user else 'loss',
                    'score_user': match.score_left if match.game.player_left == user else match.score_right,
                    'score_opponent': match.score_right if match.game.player_left == user else match.score_left,
                    'played_at': match.ended_at,
                })

            context = {
                'user': user,
                'match_count': match_count,
                'victories': victories,
                'defeats': defeats,
                'best_score': best_score,
                'friends_count': friends_count,
                'match_histories': match_histories,
            }

            rendered_html = render_to_string('accounts/profile.html', context)
            return JsonResponse({'status': 'success', 'html': rendered_html}, status=200)

        except Exception as e:
            logger.exception("Error loading user profile: %s", e)
            return JsonResponse({
                'status': 'error', 
                'message': _('Une erreur est survenue lors du chargement du profil.')
            }, status=500)
