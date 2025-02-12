import logging
from django.views import View
from django.http import JsonResponse
from django.db import transaction
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_POST, require_GET
from django.template.loader import render_to_string
from django.utils.translation import gettext as _

from accounts.forms import RegistrationForm
# Optionnel : pour interdire l'accès aux utilisateurs déjà authentifiés
from pong_project.decorators import user_not_authenticated

logger = logging.getLogger(__name__)

# Optionnel : décommenter si vous souhaitez bloquer l'accès aux utilisateurs connectés
@method_decorator(user_not_authenticated, name='dispatch')
@method_decorator(csrf_protect, name='dispatch')
class RegisterView(View):
    """
    Vue pour gérer l'inscription utilisateur.
      - GET  : Renvoie le formulaire d'inscription sous forme de fragment HTML.
      - POST : Traite les données soumises pour créer un nouvel utilisateur.
    """
    @method_decorator(require_GET)
    def get(self, request):
        form = RegistrationForm()
        rendered_form = render_to_string('accounts/register.html', {'form': form}, request=request)
        return JsonResponse({
            'status': 'success',
            'html': rendered_form,
        }, status=200)

    @method_decorator(require_POST)
    def post(self, request):
        form = RegistrationForm(request.POST)
        if form.is_valid():
            try:
                with transaction.atomic():
                    form.save()
                return JsonResponse({
                    'status': 'success',
                    'message': _('Inscription réussie.')
                }, status=201)
            except Exception as e:
                logger.exception("Erreur lors de la création de l'utilisateur: %s", e)
                return JsonResponse({
                    'status': 'error',
                    'message': _('Erreur interne du serveur.')
                }, status=500)
        else:
            # Construction d'un message d'erreur unique à partir des erreurs du formulaire
            error_messages = []
            for field, errors in form.errors.items():
                error_messages.append(f"{field}: {', '.join(errors)}")
            error_message = " ".join(error_messages)
            return JsonResponse({
                'status': 'error',
                'message': error_message,
            }, status=400)
