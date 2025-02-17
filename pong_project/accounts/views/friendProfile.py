import logging
from django.views import View
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from django.template.loader import render_to_string
from django.db.models import Max
from django.contrib.auth import get_user_model
from game.models import GameResult
from pong_project.decorators import login_required_json
from django.utils.translation import gettext as _

logger = logging.getLogger(__name__)
User = get_user_model()

@method_decorator(csrf_protect, name='dispatch')
@method_decorator(login_required_json, name='dispatch')
class FriendProfileView(View):
    """
    Affiche le profil d'un ami, incluant statistiques et historique des matchs.
    """
    def get(self, request, friend_username):
        try:
            friend = get_object_or_404(User, username=friend_username)

            # Récupération de l'historique des matchs via le Manager personnalisé
            matches = GameResult.objects.get_user_match_history(friend)
            match_count = matches.count()
            victories = matches.filter(winner=friend).count()
            defeats = matches.filter(looser=friend).count()

            best_score = max(
                matches.filter(game__player_left=friend).aggregate(Max('score_left'))['score_left__max'] or 0,
                matches.filter(game__player_right=friend).aggregate(Max('score_right'))['score_right__max'] or 0,
            )
            friends_count = friend.friends.count()

            # Constitution de l'historique détaillé
            match_histories = []
            for match in matches:
                opponent = match.game.player_right if match.game.player_left == friend else match.game.player_left
                match_histories.append({
                    'opponent': opponent.username,
                    'result': 'win' if match.winner == friend else 'loss',
                    'score_user': match.score_left if match.game.player_left == friend else match.score_right,
                    'score_opponent': match.score_right if match.game.player_left == friend else match.score_left,
                    'played_at': match.ended_at,
                })

            context = {
                'friend': friend,
                'match_count': match_count,
                'victories': victories,
                'defeats': defeats,
                'best_score': best_score,
                'friends_count': friends_count,
                'match_histories': match_histories,
            }
            rendered_html = render_to_string('accounts/friend_profile.html', context)
            return JsonResponse({'status': 'success', 'html': rendered_html}, status=200)

        except Exception as e:
            logger.exception("Erreur lors du chargement du profil de l'ami '%s': %s", friend_username, str(e))
            return JsonResponse({
                'status': 'error',
                'message': _("Erreur lors du chargement du profil de l'ami.")
            }, status=500)
