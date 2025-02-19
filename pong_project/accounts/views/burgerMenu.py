# ---- Imports standard ----
import logging

# ---- Imports tiers ----
from django.http import JsonResponse
from django.views import View
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from django.contrib.auth.decorators import login_required
from django.contrib.auth import get_user_model
from django.shortcuts import render
from django.template.loader import render_to_string
from pong_project.decorators import login_required_json
from django.utils.translation import gettext as _  # Import pour la traduction
from django.utils.timezone import now
from django.db import transaction

# ---- Imports locaux ----
from accounts.models import FriendRequest
from game.models import GameInvitation

# ---- Configuration ----
logger = logging.getLogger(__name__)
User = get_user_model()

def clean_game_invitations(user):
    """
    Supprime les invitations expirées et en doublon, avec des logs détaillant chaque action.
    Les opérations d'update sont effectuées dans une transaction atomique.
    """
    try:
        current_time = now()
        with transaction.atomic():
            # Marquer les invitations expirées comme 'expired'
            expired_invitations = GameInvitation.objects.filter(
                to_user=user, status='pending', expires_at__lt=current_time
            )
            expired_count = expired_invitations.update(status='expired')
            
            # Log des invitations expirées à cause du temps
            for invitation in expired_invitations:
                logger.info(
                    f"Invitation expirée en raison du temps : {invitation.id}, "
                    f"envoyée par {invitation.from_user.username} à {invitation.to_user.username}."
                )
            
            # Récupérer les invitations en attente (après mise à jour des expirées)
            pending_invitations = GameInvitation.objects.filter(to_user=user, status='pending')
            latest_ids = []
            from_user_ids = pending_invitations.values_list('from_user', flat=True).distinct()
            
            # Trouver pour chaque from_user l'invitation la plus récente
            for user_id in from_user_ids:
                latest_inv = pending_invitations.filter(from_user=user_id).order_by('-created_at').first()
                if latest_inv:
                    latest_ids.append(latest_inv.id)
            
            # Marquer comme 'expired' toutes les invitations en doublon
            duplicate_invitations = pending_invitations.exclude(id__in=latest_ids)
            duplicate_count = duplicate_invitations.update(status='expired')
            
            # Log des invitations marquées comme doublon
            for invitation in duplicate_invitations:
                logger.info(
                    f"Invitation marquée comme doublon : {invitation.id}, "
                    f"envoyée par {invitation.from_user.username} à {invitation.to_user.username}."
                )
            
            return expired_count + duplicate_count
    except Exception as e:
        logger.error(f"Erreur lors du nettoyage des invitations pour l'utilisateur {user.username}: {e}")
        return 0

def get_burger_menu_context(user):
    """
    Retourne le contexte nécessaire pour le template du burger menu.
    Avant d'ajouter les invitations au contexte, on nettoie les invitations expirées et en doublon.
    """
    clean_game_invitations(user)  # Nettoyage des invitations avant de les inclure dans le contexte
    
    default_avatar = '/media/avatars/default_avatar.png'
    return {
        'user': user,
        'friends': user.friends.all(),
        'friend_requests': FriendRequest.objects.filter(to_user=user),
        'game_invitations': GameInvitation.objects.filter(to_user=user, status='pending'),
        'avatar_url': user.avatar.url if user.avatar else default_avatar,
    }

@method_decorator(login_required_json, name='dispatch')
class BurgerMenuView(View):
    """
    Gère la récupération des données utilisateur pour le burger menu.
    """
    @method_decorator(login_required)
    def get(self, request):
        """
        Rendu du menu burger avec les données utilisateur, la liste d'amis et les demandes d'ami.
        """
        try:
            context = get_burger_menu_context(request.user)
            burger_menu_html = render_to_string('accounts/burger_menu.html', context)
            return JsonResponse({'status': 'success', 'html': burger_menu_html})
        except Exception as e:
            logger.exception("Erreur lors de la récupération du menu burger: %s", e)
            return JsonResponse({'status': 'error', 'message': str(e)}, status=500)

@method_decorator([csrf_protect], name='dispatch')
@method_decorator(login_required_json, name='dispatch')
class UpdateStatusView(View):
    """
    Gère la mise à jour du statut en ligne/hors ligne de l'utilisateur.
    """
    def post(self, request):
        """
        Met à jour le statut en ligne/hors ligne de l'utilisateur.
        """
        user = request.user
        status = request.POST.get('status')
        
        if status not in ['online', 'offline']:
            return JsonResponse({'status': 'error', 'message': _('Statut non valide')}, status=400)
        
        try:
            with transaction.atomic():
                user.is_online = (status == 'online')
                user.save(update_fields=['is_online'])
            logger.info("Statut mis à jour pour %s: %s", user.username, user.is_online)
            return JsonResponse({
                'status': 'success',
                'message': _('Statut mis à jour avec succès'),
                'is_online': user.is_online
            })
        except Exception as e:
            logger.exception("Erreur lors de la mise à jour du statut pour %s: %s", user.username, e)
            return JsonResponse({'status': 'error', 'message': _('Erreur interne du serveur')}, status=500)
