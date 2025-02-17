import logging

from django.views import View
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django.contrib.auth import get_user_model
from django.db import transaction
from django.views.decorators.csrf import csrf_protect
from django.core.exceptions import ValidationError
from django.db import transaction
from pong_project.decorators import login_required_json
from django.utils.translation import gettext as _  # Import pour la traduction

from accounts.models import FriendRequest

# ---- Configuration ----
User = get_user_model()
logger = logging.getLogger(__name__)


class FriendValidationError(Exception):
    """Exception personnalisée pour les erreurs de validation d'ami."""
    pass

@method_decorator(csrf_protect, name='dispatch')
@method_decorator(login_required_json, name='dispatch')
class BaseFriendView(View):
    """
    Classe de base pour les opérations liées aux amis.
    """
    def validate_friend(self, user, friend_username):
        if not friend_username:
            raise FriendValidationError(_("Nom d'utilisateur de l'ami manquant"))
        friend_username = friend_username.strip()
        try:
            friend = User.objects.get(username=friend_username)
        except User.DoesNotExist:
            raise FriendValidationError(_("Ami introuvable"))
        if friend == user:
            raise FriendValidationError(_("Vous ne pouvez pas vous envoyer une demande d'ami à vous-même."))
        return friend

    def create_json_response(self, status, message, status_code=200):
        return JsonResponse({'status': status, 'message': message}, status=status_code)


@method_decorator(csrf_protect, name='dispatch')
@method_decorator(login_required_json, name='dispatch')
class AddFriendView(BaseFriendView):
    """
    Gère l'envoi de demandes d'ami.
    """
    def post(self, request):
        user = request.user
        friend_username = (request.POST.get('friend_username') or "").strip()
        try:
            friend = self.validate_friend(user, friend_username)
            if friend in user.friends.all():
                return self.create_json_response('error', _('Vous êtes déjà ami avec cet utilisateur.'), status_code=400)
            if FriendRequest.objects.filter(from_user=user, to_user=friend).exists():
                return self.create_json_response('error', _("Demande d'ami déjà envoyée."), status_code=400)
            if FriendRequest.objects.filter(from_user=friend, to_user=user).exists():
                return self.create_json_response('error', _("Cet utilisateur vous a déjà envoyé une demande d'ami."), status_code=400)

            FriendRequest.objects.create(from_user=user, to_user=friend)
            logger.info("Demande d'ami envoyée de %s à %s.", user.username, friend.username)
            return self.create_json_response('success', _("Demande d'ami envoyée."), status_code=200)

        except FriendValidationError as e:
            logger.error("Erreur lors de l'ajout d'un ami: %s", e)
            return self.create_json_response('error', str(e), status_code=400)
        except Exception as e:
            logger.exception("Erreur inattendue lors de l'ajout d'un ami pour %s: %s", user.username, str(e))
            return self.create_json_response('error', _("Erreur lors de l'envoi de la demande d'ami."), status_code=500)


@method_decorator(csrf_protect, name='dispatch')
@method_decorator(login_required_json, name='dispatch')
class HandleFriendRequestView(View):
    """
    Gère l'acceptation ou le refus des demandes d'ami.
    """
    @transaction.atomic
    def post(self, request):
        user = request.user
        try:
            request_id = request.POST.get('request_id')
            action = request.POST.get('action')
            friend_request = get_object_or_404(FriendRequest, id=request_id, to_user=user)

            if action == 'accept':
                user.friends.add(friend_request.from_user)
                friend_request.from_user.friends.add(user)
                friend_request.delete()
                logger.info("Demande d'ami acceptée entre %s et %s.", user.username, friend_request.from_user.username)
                return JsonResponse({'status': 'success', 'message': _("Demande d'ami acceptée")}, status=200)

            elif action == 'decline':
                friend_request.delete()
                logger.info("Demande d'ami refusée entre %s et %s.", user.username, friend_request.from_user.username)
                return JsonResponse({'status': 'success', 'message': _("Demande d'ami refusée")}, status=200)
            else:
                logger.warning("Action non valide lors du traitement de la demande d'ami pour %s.", user.username)
                return JsonResponse({'status': 'error', 'message': _("Action non valide")}, status=400)

        except Exception as e:
            logger.exception("Erreur lors du traitement de la demande d'ami pour %s: %s", user.username, str(e))
            return JsonResponse({'status': 'error', 'message': _("Erreur lors de la gestion de la demande d'ami")}, status=500)


@method_decorator(csrf_protect, name='dispatch')
@method_decorator(login_required_json, name='dispatch')
class RemoveFriendView(BaseFriendView):
    """
    Gère la suppression d'un ami.
    """
    def post(self, request):
        user = request.user
        friend_username = (request.POST.get('friend_username') or "").strip()
        try:
            friend = self.validate_friend(user, friend_username)
            if friend not in user.friends.all():
                return self.create_json_response('error', _("Cet utilisateur n'est pas dans votre liste d'amis."), status_code=400)

            # Suppression réciproque de l'amitié
            user.friends.remove(friend)
            friend.friends.remove(user)
            logger.info("Amitié supprimée entre %s et %s.", user.username, friend.username)
            return self.create_json_response('success', _("Ami supprimé avec succès."), status_code=200)

        except FriendValidationError as e:
            logger.error("Erreur lors de la suppression d'un ami: %s", e)
            return self.create_json_response('error', str(e), status_code=400)
        except Exception as e:
            logger.exception("Erreur inattendue lors de la suppression d'un ami pour %s: %s", user.username, str(e))
            return self.create_json_response('error', _("Erreur lors de la suppression de l'ami."), status_code=500)
