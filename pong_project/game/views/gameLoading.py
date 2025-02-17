import logging
from django.views import View
from django.http import JsonResponse
from django.template.loader import render_to_string
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from pong_project.decorators import login_required_json
from django.utils.translation import gettext as _

logger = logging.getLogger(__name__)

@method_decorator(csrf_protect, name='dispatch')
@method_decorator(login_required_json, name='dispatch')
class LoadingView(View):
    def get(self, request, *args, **kwargs):
        try:
            html = render_to_string('game/loading.html', request=request)
            return JsonResponse({'status': 'success', 'html': html}, status=200)
        except Exception as e:
            logger.exception("Erreur lors du rendu de l'écran de chargement : %s", e)
            return JsonResponse({'status': 'error', 'message': _("Erreur interne du serveur")}, status=500)

