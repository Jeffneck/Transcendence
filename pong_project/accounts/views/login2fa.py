# accounts/views/2fa.py

import base64
from io import BytesIO
import logging

import pyotp
import qrcode

from django.http import JsonResponse
from django.views import View
from django.template.loader import render_to_string
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_POST
from django.contrib.auth import get_user_model, login
from django.shortcuts import get_object_or_404
from django.utils.translation import gettext as _

from accounts.utils import generate_jwt_token
from accounts.forms import TwoFactorLoginForm
from pong_project.decorators import login_required_json, auth_partial_required, user_not_authenticated

logger = logging.getLogger(__name__)
User = get_user_model()


class Base2FAView(View):
    """
    Vue de base fournissant des utilitaires communs à la 2FA.
    """
    def generate_totp_qr(self, user, secret):
        try:
            totp = pyotp.TOTP(secret)
            # Création de l'URI de provisioning avec l'issuer souhaité
            provisioning_uri = totp.provisioning_uri(name=user.username, issuer_name="Transcendence")
            img = qrcode.make(provisioning_uri)
            buffered = BytesIO()
            img.save(buffered, format="PNG")
            # Encodage en base64 pour intégrer dans du HTML
            return base64.b64encode(buffered.getvalue()).decode('utf-8')
        except Exception as e:
            logger.exception("Erreur lors de la génération du QR code: %s", e)
            raise


@method_decorator(csrf_protect, name='dispatch')
@method_decorator(login_required_json, name='dispatch')
class Enable2FAView(Base2FAView):
    """
    Active la 2FA pour l'utilisateur connecté en générant un secret et un QR code.
    """
    def get(self, request):
        if request.user.is_2fa_enabled:
            return JsonResponse({
                'status': 'error',
                'message': _("Le 2FA est déjà activé sur votre compte.")
            }, status=400)
        try:
            # Génération d'un nouveau secret et QR code associé
            secret = pyotp.random_base32()
            qr_code = self.generate_totp_qr(request.user, secret)
    
            # Stockage du secret dans la session (expire au bout de 5 minutes)
            request.session['totp_secret'] = secret
            request.session.set_expiry(300)
    
            # Rendu du formulaire d'activation sans exposer le secret
            html_content = render_to_string(
                'accounts/enable_2fa.html',
                {'qr_code': qr_code, '2FA_form': TwoFactorLoginForm()},
                request=request
            )
            return JsonResponse({
                'status': 'success',
                'html': html_content,
            }, status=200)
        except Exception as e:
            logger.exception("Erreur dans Enable2FAView GET: %s", e)
            return JsonResponse({
                'status': 'error',
                'message': _("Une erreur est survenue lors de l'activation de la 2FA.")
            }, status=500)


@method_decorator(csrf_protect, name='dispatch')
@method_decorator(login_required_json, name='dispatch')
@method_decorator(require_POST, name='dispatch')
class Check2FAView(View):
    """
    Vérifie le code TOTP soumis pour activer la 2FA.
    """
    def post(self, request):
        try:
            totp_secret = request.session.get('totp_secret')
            if not totp_secret:
                return JsonResponse({
                    'status': 'error',
                    'message': _("Aucune configuration 2FA en cours.")
                }, status=400)
    
            code = request.POST.get('code')
            if not code:
                return JsonResponse({
                    'status': 'error',
                    'message': _("Un code est requis.")
                }, status=400)
    
            totp = pyotp.TOTP(totp_secret)
            if totp.verify(code):
                request.user.totp_secret = totp_secret
                request.user.is_2fa_enabled = True
                request.user.save(update_fields=['totp_secret', 'is_2fa_enabled'])
                # Retrait du secret de la session
                request.session.pop('totp_secret', None)
                return JsonResponse({
                    'status': 'success',
                    'message': _("Le 2FA a été activé avec succès.")
                }, status=200)
    
            return JsonResponse({
                'status': 'error',
                'message': _("Code 2FA invalide.")
            }, status=400)
        except Exception as e:
            logger.exception("Erreur inattendue dans Check2FAView POST: %s", e)
            return JsonResponse({
                'status': 'error',
                'message': _("Une erreur inattendue est survenue.")
            }, status=500)


@method_decorator(csrf_protect, name='dispatch')
@method_decorator(user_not_authenticated, name='dispatch')
@method_decorator(auth_partial_required, name='dispatch')
class Login2faView(View):
    """
    Vérifie le code 2FA lors de la connexion partielle.
    """
    def get(self, request):
        try:
            login2fa_form = TwoFactorLoginForm()
            html_content = render_to_string(
                'accounts/login2fa.html',
                {'login2fa_form': login2fa_form},
                request=request
            )
            return JsonResponse({
                'status': 'success',
                'html': html_content,
            }, status=200)
        except Exception as e:
            logger.exception("Erreur lors du rendu du formulaire 2FA: %s", e)
            return JsonResponse({
                'status': 'error',
                'message': _("Une erreur est survenue lors du rendu du formulaire.")
            }, status=500)
    
    def post(self, request):
        try:
            user_id = request.session.get('user_id')
            auth_partial = request.session.get('auth_partial')
    
            if not user_id or not auth_partial:
                return JsonResponse({
                    'status': 'error',
                    'message': _("Accès non autorisé")
                }, status=403)
    
            user = get_object_or_404(User, id=user_id)
            code = request.POST.get('code')
            if not code:
                return JsonResponse({
                    'status': 'error',
                    'message': _("Un code est requis.")
                }, status=400)
    
            if not user.totp_secret:
                return JsonResponse({
                    'status': 'error',
                    'message': _("Aucun secret 2FA configuré pour cet utilisateur.")
                }, status=400)
    
            totp = pyotp.TOTP(user.totp_secret)
            if totp.verify(code):
                token_jwt = generate_jwt_token(user)
                user.is_online = True
                user.save(update_fields=['is_online'])
                login(request, user)
                request.session.pop('auth_partial', None)
                request.session.pop('user_id', None)
    
                return JsonResponse({
                    'status': 'success',
                    'access_token': token_jwt.get('access_token'),
                    'refresh_token': token_jwt.get('refresh_token'),
                    'is_authenticated': True,
                    'message': _("2FA vérifié avec succès. Connexion réussie.")
                }, status=200)
    
            return JsonResponse({
                'status': 'error',
                'message': _("Code 2FA invalide.")
            }, status=400)
        except Exception as e:
            logger.exception("Erreur inattendue dans Login2faView POST: %s", e)
            return JsonResponse({
                'status': 'error',
                'message': _("Une erreur inattendue est survenue.")
            }, status=500)


@method_decorator(csrf_protect, name='dispatch')
@method_decorator(login_required_json, name='dispatch')
class Disable2FAView(View):
    """
    Désactive la 2FA pour l'utilisateur authentifié.
    """
    def get(self, request):
        try:
            if not request.user.is_2fa_enabled:
                return JsonResponse({
                    'status': 'error',
                    'message': _("Le 2FA n'est pas activé sur votre compte.")
                }, status=400)
    
            disable_form = TwoFactorLoginForm()
            html_content = render_to_string(
                'accounts/disable_2fa.html',
                {'disable_form': disable_form},
                request=request
            )
            return JsonResponse({
                'status': 'success',
                'html': html_content
            }, status=200)
        except Exception as e:
            logger.exception("Erreur dans Disable2FAView GET: %s", e)
            return JsonResponse({
                'status': 'error',
                'message': _("Une erreur est survenue lors du rendu du formulaire.")
            }, status=500)
    
    def post(self, request):
        try:
            if not request.user.is_2fa_enabled:
                return JsonResponse({
                    'status': 'error',
                    'message': _("Le 2FA n'est pas activé sur votre compte.")
                }, status=400)
    
            code = request.POST.get('code')
            if not code:
                return JsonResponse({
                    'status': 'error',
                    'message': _("Un code est requis.")
                }, status=400)
    
            totp = pyotp.TOTP(request.user.totp_secret)
            if totp.verify(code):
                request.user.totp_secret = ''
                request.user.is_2fa_enabled = False
                request.user.save(update_fields=['totp_secret', 'is_2fa_enabled'])
                return JsonResponse({
                    'status': 'success',
                    'message': _("Le 2FA a été désactivé avec succès.")
                }, status=200)
    
            return JsonResponse({
                'status': 'error',
                'message': _("Code 2FA invalide.")
            }, status=400)
        except Exception as e:
            logger.exception("Erreur inattendue dans Disable2FAView POST: %s", e)
            return JsonResponse({
                'status': 'error',
                'message': _("Une erreur inattendue est survenue.")
            }, status=500)
