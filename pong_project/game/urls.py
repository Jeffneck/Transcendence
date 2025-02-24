

from django.urls import path

from .views.gameHome import GameHomeView
from .views.gameMenu import GameMenuView
from .views.gameLoading import LoadingView
from .views.gameLocal import StartLocalGameView, CreateGameLocalView
from .views.gameResults import GameResultsView 
from .views.gameStatus import GetGameStatusView 
from .views.gameOnline import CreateGameOnlineView, SendGameSessionInvitationView, AcceptGameInvitationView, RejectGameInvitationView, CheckGameInvitationStatusView, StartOnlineGameView, JoinOnlineGameAsLeftView, JoinOnlineGameAsRightView
from .views.gameTournament import CreateTournamentView, CreateTournamentGameSessionView, StartTournamentGameSessionView, TournamentBracketView, TournamentNextGameView
import logging


logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.DEBUG)



app_name = 'game'

urlpatterns = [
    path('home/', GameHomeView.as_view(), name='home'),  
    path('menu/', GameMenuView.as_view(), name='game_menu'),  
    path('loading/', LoadingView.as_view(), name='loading'),  
    path('create_local_game/', CreateGameLocalView.as_view(), name='create_local_game'),
    path('start_local_game/<uuid:game_id>/', StartLocalGameView.as_view(), name='start_local_game'),
    path('create_tournament/', CreateTournamentView.as_view(), name='create_tournament'),
    path('tournament_bracket/<uuid:tournament_id>/', TournamentBracketView.as_view(), name='tournament_bracket'),
    path('tournament_next_game/<uuid:tournament_id>/', TournamentNextGameView.as_view(), name='tournament_next_game'),
    path('create_tournament_game_session/<uuid:tournament_id>/', CreateTournamentGameSessionView.as_view(), name='create_tournament_gameSession'),
    path('start_tournament_game_session/<uuid:game_id>/', StartTournamentGameSessionView.as_view(), name='start_tournament_gameSession'),

    path('create_game_online/', CreateGameOnlineView.as_view(), name='create_game_online'),
    path('send_gameSession_invitation/', SendGameSessionInvitationView.as_view(), name='send_gameSession_invitation'),
    path('join_online_game_as_left/<uuid:game_id>/', JoinOnlineGameAsLeftView.as_view(), name='join_online_game_as_left'),
    path('start_online_game/<uuid:game_id>/', StartOnlineGameView.as_view(), name='start_online_game'),

    path('accept_game_invitation/<uuid:invitation_id>/', AcceptGameInvitationView.as_view(), name='accept_game_invitation'),
    path('join_online_game_as_right/<uuid:game_id>/', JoinOnlineGameAsRightView.as_view(), name='join_online_game_as_right'),
    path('reject_game_invitation/<uuid:invitation_id>/', RejectGameInvitationView.as_view(), name='reject_game_invitation'),

    
    path('check_invitation_status/<uuid:invitation_id>/', CheckGameInvitationStatusView.as_view(), name='check_invitation_status'),
    
    path('game_results/<uuid:game_id>/', GameResultsView.as_view(), name='get_local_results'),
    path('get_game_status/<uuid:game_id>/', GetGameStatusView.as_view(), name='get_game_status'),
]
