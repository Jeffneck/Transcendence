# gameOnline.py
import logging
from django.views import View
from django.http import JsonResponse
from django.template.loader import render_to_string
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from pong_project.decorators import login_required_json
from django.shortcuts import get_object_or_404
from django.db.models import Q
from django.utils.timezone import now
from accounts.models import CustomUser
from game.models import GameSession, GameInvitation
from game.forms import GameParametersForm
from game.manager import schedule_game
from django.utils.translation import gettext as _  # Import pour la traduction
from django.db import transaction

logger = logging.getLogger(__name__)


@method_decorator(csrf_protect, name='dispatch')
@method_decorator(login_required_json, name='dispatch')
class CreateGameOnlineView(View):
    """
    Crée une session de jeu en ligne et prépare l'invitation des amis.
    """
    def post(self, request, *args, **kwargs):
        try:
            form = GameParametersForm(request.POST)
            if not form.is_valid():
                logger.warning("Paramètres du jeu en ligne invalides : %s", form.errors)
                return JsonResponse({
                    'status': 'error',
                    'message': _("Paramètres invalides."),
                    'errors': form.errors
                }, status=400)
            with transaction.atomic():
                session = GameSession.objects.create(
                    status='waiting',
                    is_online=True,
                    player_left=request.user
                )
                parameters = form.save(commit=False)
                parameters.game_session = session
                parameters.save()

            friends = request.user.friends.all()
            if not friends.exists():
                return JsonResponse({
                    'status': 'error',
                    'message': _("Vous n'avez pas encore ajouté d'amis. Ajoutez des amis pour les inviter à jouer.")
                }, status=400)

            html = render_to_string('game/online_game/invite_game.html', {
                'game_id': session.id,
                'friends': friends
            }, request=request)
            logger.info("GameSession en ligne %s créée par %s.", session.id, request.user.username)
            return JsonResponse({
                'status': 'success',
                'message': _("Partie en ligne créée avec succès."),
                'game_id': str(session.id),
                'html': html
            }, status=200)
        except Exception as e:
            logger.exception("Erreur lors de la création de la partie en ligne : %s", e)
            return JsonResponse({'status': 'error', 'message': _("Erreur interne du serveur")}, status=500)


@method_decorator(csrf_protect, name='dispatch')
@method_decorator(login_required_json, name='dispatch')
class SendGameSessionInvitationView(View):
    """
    Envoie une invitation pour une session de jeu en ligne.
    """
    def post(self, request, *args, **kwargs):
        try:
            session_id = request.POST.get('session_id', '').strip()
            friend_username = request.POST.get('friend_username', '').strip()
            if not session_id or not friend_username:
                return JsonResponse({
                    'status': 'error',
                    'message': _("Données manquantes (session_id ou friend_username).")
                }, status=400)

            session = get_object_or_404(GameSession, id=session_id, is_online=True)
            if session.player_left != request.user:
                return JsonResponse({
                    'status': 'error',
                    'message': _("Vous n'êtes pas autorisé à inviter pour cette session.")
                }, status=403)

            try:
                friend = CustomUser.objects.get(username=friend_username)
            except CustomUser.DoesNotExist:
                return JsonResponse({
                    'status': 'error',
                    'message': _("Ami introuvable.")
                }, status=404)

            if friend == request.user:
                return JsonResponse({
                    'status': 'error',
                    'message': _("Vous ne pouvez pas vous inviter vous-même.")
                }, status=400)

            if GameInvitation.objects.filter(from_user=request.user, to_user=friend, session=session, status='pending').exists():
                return JsonResponse({
                    'status': 'error',
                    'message': _("Une invitation est déjà en attente pour cette session.")
                }, status=400)

            with transaction.atomic():
                invitation = GameInvitation.objects.create(
                    from_user=request.user,
                    to_user=friend,
                    session=session,
                    status='pending'
                )
            html = render_to_string('game/online_game/loading.html', request=request)
            logger.info("Invitation %s envoyée de %s à %s pour la session %s.", invitation.id, request.user.username, friend.username, session.id)
            return JsonResponse({
                'status': 'success',
                'html': html,
                'message': _('Invitation envoyée.'),
                'invitation_id': invitation.id
            }, status=200)
        except Exception as e:
            logger.exception("Erreur lors de l'envoi d'invitation pour la session en ligne : %s", e)
            return JsonResponse({'status': 'error', 'message': _("Erreur interne du serveur")}, status=500)


@method_decorator(csrf_protect, name='dispatch')
@method_decorator(login_required_json, name='dispatch')
class AcceptGameInvitationView(View):
    """
    Le joueur destinataire accepte une invitation et démarre la session.
    """
    def post(self, request, invitation_id):
        try:
            with transaction.atomic():
                # On verrouille l'invitation pour éviter les modifications concurrentes
                invitation = GameInvitation.objects.select_for_update().get(
                    id=invitation_id,
                    to_user=request.user,
                    status='pending'
                )
                session = invitation.session
                if not session:
                    return JsonResponse({
                        'status': 'error',
                        'message': _("Cette invitation ne référence aucune session.")
                    }, status=400)
                if session.player_right is not None:
                    return JsonResponse({
                        'status': 'error',
                        'message': _("Un second joueur est déjà positionné sur cette session.")
                    }, status=400)
                if session.status != 'waiting':
                    return JsonResponse({
                        'status': 'error',
                        'message': _(f"La session n'est pas en attente (status={session.status}).")
                    }, status=400)
                # On met à jour l'invitation et la session
                invitation.status = 'accepted'
                invitation.save(update_fields=['status'])
                session.player_right = request.user
                session.save(update_fields=['player_right'])
                # Expirer toutes les autres invitations en attente pour cette session
                GameInvitation.objects.filter(session=session, status='pending').exclude(id=invitation.id).update(status='expired')
                logger.info("Invitation %s acceptée par %s pour la session %s.", invitation.id, request.user.username, session.id)
            schedule_game(session.id)
            return JsonResponse({
                'status': 'success',
                'message': _('Invitation acceptée, session mise à jour.'),
                'session': {
                    'id': str(session.id),
                    'player_left': session.player_left.username,
                    'player_right': session.player_right.username,
                    'status': session.status,
                }
            }, status=200)
        except GameInvitation.DoesNotExist:
            logger.warning(f"Invitation non trouvée ou déjà traitée: id={invitation_id}, user={request.user.username}")
            return JsonResponse({
                'status': 'error',
                'message': _("Invitation non trouvée ou déjà traitée.")
            }, status=404)
        except Exception as e:
            logger.exception("Erreur dans AcceptGameInvitationView: %s", e)
            return JsonResponse({'status': 'error', 'message': _('Erreur interne du serveur')}, status=500)


@method_decorator(csrf_protect, name='dispatch')
@method_decorator(login_required_json, name='dispatch')
class RejectGameInvitationView(View):
    """
    Permet au destinataire de rejeter une invitation.
    """
    def post(self, request, invitation_id):
        try:
            with transaction.atomic():
                # On verrouille l'invitation pour éviter les modifications concurrentes
                invitation = GameInvitation.objects.select_for_update().get(
                    id=invitation_id,
                    to_user=request.user,
                    status='pending'
                )
                invitation.status = 'rejected'
                invitation.save(update_fields=['status'])
                logger.info("Invitation %s rejetée par %s.", invitation.id, request.user.username)
            return JsonResponse({'status': 'success', 'message': _("Invitation refusée.")}, status=200)
        except GameInvitation.DoesNotExist:
            logger.warning("Invitation non trouvée ou déjà traitée: id=%s, user=%s", invitation_id, request.user.username)
            return JsonResponse({
                'status': 'error',
                'message': _("Invitation non trouvée ou déjà traitée.")
            }, status=404)
        except Exception as e:
            logger.exception("Erreur dans RejectGameInvitationView: %s", e)
            return JsonResponse({'status': 'error', 'message': _('Erreur interne du serveur')}, status=500)


@method_decorator(csrf_protect, name='dispatch')
@method_decorator(login_required_json, name='dispatch')
class CheckGameInvitationStatusView(View):
    """
    Retourne le statut actuel d'une invitation.
    """
    def get(self, request, invitation_id):
        try:
            with transaction.atomic():
                # On verrouille l'invitation pour éviter des mises à jour concurrentes
                invitation = GameInvitation.objects.select_for_update().get(id=invitation_id)
                if invitation.from_user != request.user and invitation.to_user != request.user:
                    logger.warning("User %s non autorisé à consulter invitation %s.", request.user.username, invitation.id)
                    return JsonResponse({
                        'status': 'error',
                        'message': _("Vous n'êtes pas autorisé à consulter cette invitation.")
                    }, status=403)

                # Si l'invitation est expirée et toujours en attente, on la met à jour
                if invitation.status == 'pending' and invitation.is_expired():
                    invitation.status = 'expired'
                    invitation.save(update_fields=['status'])
                    logger.info("Invitation %s expirée pour cause de délai dépassé.", invitation.id)

            return JsonResponse({
                'status': 'success',
                'invitation_status': invitation.status,
                # 'expired': invitation.is_expired(),
                'session_id': str(invitation.session.id) if invitation.session else None
            }, status=200)
        except GameInvitation.DoesNotExist:
            logger.warning("Invitation non trouvée: id=%s", invitation_id)
            return JsonResponse({'status': 'error', 'message': _("Invitation non trouvée.")}, status=404)
        except Exception as e:
            logger.exception("Erreur dans CheckGameInvitationStatusView: %s", e)
            return JsonResponse({'status': 'error', 'message': _('Internal server error')}, status=500)


@method_decorator(csrf_protect, name='dispatch')
@method_decorator(login_required_json, name='dispatch')
class JoinOnlineGameAsLeftView(View):
    """
    Permet au joueur de gauche de rejoindre une session en ligne.
    """
    def post(self, request, game_id):
        try:
            session = get_object_or_404(GameSession, id=game_id)
            if not session.is_online:
                return JsonResponse({'status': 'error', 'message': _("Cette session n'est pas une partie en ligne.")}, status=400)
            if request.user not in [session.player_left, session.player_right]:
                return JsonResponse({'status': 'error', 'message': _("Vous n'êtes pas autorisé à rejoindre cette partie.")}, status=403)
            if session.status in ['running', 'finished']:
                return JsonResponse({'status': 'error', 'message': _("La partie est déjà lancée ou terminée.")}, status=400)
            context = {
                'player_left_name': session.player_left.get_username(),
                'player_right_name': session.player_right.get_username() if session.player_right else "",
            }
            rendered_html = render_to_string('game/live_game.html', context, request=request)
            return JsonResponse({
                'status': 'success',
                'html': rendered_html,
                'game_id': str(session.id),
                'message': _("Partie {} rejointe (online).").format(game_id)
            }, status=200)
        except Exception as e:
            logger.exception("Erreur dans JoinOnlineGameAsLeftView: %s", e)
            return JsonResponse({'status': 'error', 'message': _('Erreur interne du serveur')}, status=500)


@method_decorator(csrf_protect, name='dispatch')
@method_decorator(login_required_json, name='dispatch')
class JoinOnlineGameAsRightView(View):
    """
    Démarre la partie en ligne pour le joueur droit.
    """
    def post(self, request, game_id):
        try:
            session = get_object_or_404(GameSession, id=game_id)
            if not session.is_online:
                return JsonResponse({'status': 'error', 'message': _("Cette session n'est pas une partie en ligne.")}, status=400)
            if request.user not in [session.player_left, session.player_right]:
                return JsonResponse({'status': 'error', 'message': _("Vous n'êtes pas autorisé à accéder à cette partie.")}, status=403)
            context = {
                'player_left_name': session.player_left.get_username(),
                'player_right_name': session.player_right.get_username() if session.player_right else "",
            }
            rendered_html = render_to_string('game/live_game.html', context, request=request)
            return JsonResponse({
                'status': 'success',
                'html': rendered_html,
                'game_id': str(session.id),
                'message': _("Partie {} lancée (online).").format(game_id)
            }, status=200)
        except Exception as e:
            logger.exception("Erreur dans JoinOnlineGameAsRightView: %s", e)
            return JsonResponse({'status': 'error', 'message': _('Erreur interne du serveur')}, status=500)


@method_decorator(csrf_protect, name='dispatch')
@method_decorator(login_required_json, name='dispatch')
class StartOnlineGameView(View):
    """
    Démarre une partie en ligne.
    """
    def post(self, request, game_id):
        try:
            user_role = request.POST.get('userRole')
            if user_role not in ['left', 'right']:
                return JsonResponse({'status': 'error', 'message': _("Rôle utilisateur invalide. Attendu 'left' ou 'right'.")}, status=400)
            with transaction.atomic():
                session = get_object_or_404(GameSession, id=game_id)
                if not session.is_online:
                    return JsonResponse({'status': 'error', 'message': _("La partie locale ne peut pas être lancée avec cette API.")}, status=400)
                if session.status == 'finished':
                    return JsonResponse({'status': 'error', 'message': _("La partie {} est déjà terminée.").format(game_id)}, status=400)
                if user_role == "right":
                    session.ready_right = True
                elif user_role == "left":
                    session.ready_left = True
                if session.ready_right and session.ready_left:
                    session.status = 'running'
                session.save()
                logger.info("StartOnlineGameView: Session %s prête pour le joueur %s (ready_left=%s, ready_right=%s).", 
                            session.id, user_role, session.ready_left, session.ready_right)
            return JsonResponse({'status': 'success', 'message': _("Partie {} prête pour le joueur {}.").format(game_id, user_role)}, status=200)
        except Exception as e:
            logger.exception("Erreur dans StartOnlineGameView: %s", e)
            return JsonResponse({'status': 'error', 'message': _('Erreur interne du serveur')}, status=500)
