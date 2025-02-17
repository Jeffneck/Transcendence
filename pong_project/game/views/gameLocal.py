import logging
from django.views import View
from django.http import JsonResponse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from django.template.loader import render_to_string
from game.models import GameSession
from game.forms import GameParametersForm
from game.manager import schedule_game
from pong_project.decorators import login_required_json
from django.utils.translation import gettext as _

logger = logging.getLogger(__name__)

@method_decorator(csrf_protect, name='dispatch')
@method_decorator(login_required_json, name='dispatch')
class CreateGameLocalView(View):
    """
    Crée une nouvelle partie locale avec ses paramètres.
    """
    def post(self, request, *args, **kwargs):
        try:
            # Si l'utilisateur tente d'utiliser un mode tactile non supporté
            if request.POST.get('is_touch', 'false') == "true":
                return JsonResponse({'status': 'error', 'message': _('Mode non disponible pour le tactile')}, status=403)
            
            form = GameParametersForm(request.POST)
            if not form.is_valid():
                logger.warning("Paramètres du jeu invalides : %s", form.errors)
                return JsonResponse({'status': 'error', 'message': _("Les paramètres du jeu sont invalides.")}, status=400)
            
            session = GameSession.objects.create(status='waiting', is_online=False)
            # Valeurs par défaut pour une partie locale
            session.player_left_local = "PLAYER 1"
            session.player_right_local = "PLAYER 2"
            session.save()
            
            parameters = form.save(commit=False)
            parameters.game_session = session
            parameters.save()
            
            logger.info("GameSession %s créée pour une partie locale.", session.id)
            
            context = {
                'player_left_name': session.player_left_local,
                'player_right_name': session.player_right_local,
            }
            html = render_to_string('game/live_game.html', context, request=request)
            return JsonResponse({
                'status': 'success',
                'html': html,
                'message': _("Partie locale créée avec succès."),
                'game_id': str(session.id)
            }, status=201)
        except Exception as e:
            logger.exception("Erreur lors de la création de la partie locale : %s", e)
            return JsonResponse({'status': 'error', 'message': _("Erreur interne du serveur")}, status=500)

@method_decorator(csrf_protect, name='dispatch')
@method_decorator(login_required_json, name='dispatch')
class StartLocalGameView(View):
    """
    Démarre une partie locale en vérifiant les états de la session.
    """
    def post(self, request, game_id, *args, **kwargs):
        try:
            session = GameSession.objects.get(id=game_id)
            if session.is_online:
                return JsonResponse({
                    'status': 'error',
                    'message': _("La partie en ligne ne peut pas être lancée avec cette API.")
                }, status=400)
            if session.status in ['running', 'finished']:
                return JsonResponse({
                    'status': 'error',
                    'message': _(f"La partie {game_id} est déjà lancée ou terminée.")
                }, status=400)
            
            session.status = 'running'
            session.ready_left = True
            session.ready_right = True
            session.save()
            
            schedule_game(game_id)
            logger.info("Partie locale %s lancée avec succès.", game_id)
            return JsonResponse({'status': 'success', 'message': _(f"Partie {game_id} lancée avec succès.")}, status=200)
        except GameSession.DoesNotExist:
            logger.error("GameSession %s inexistante.", game_id)
            return JsonResponse({'status': 'error', 'message': _("La session de jeu spécifiée n'existe pas.")}, status=404)
        except Exception as e:
            logger.exception("Erreur lors du démarrage de la partie locale %s : %s", game_id, e)
            return JsonResponse({'status': 'error', 'message': _("Erreur interne du serveur")}, status=500)
