
# game/models.py
import uuid
from datetime import timedelta
from django.db import models
from django.utils.timezone import now, now as timezone_now
from django.contrib.auth import get_user_model

User = get_user_model()  

# -------------------
# GAME SESSION & PARAMETERS
# -------------------

class GameSession(models.Model):
    """
    Représente une partie de jeu (en cours ou terminée).
    """
    STATUS_CHOICES = [
        ('waiting', 'Waiting'),
        ('running', 'Running'),
        ('finished', 'Finished'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tournament_id = models.UUIDField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='waiting')
    is_online = models.BooleanField(default=False)

    player_left = models.ForeignKey(User, related_name='game_sessions_as_player_left', on_delete=models.CASCADE, null=True, blank=True)
    player_right = models.ForeignKey(User, related_name='game_sessions_as_player_right', on_delete=models.CASCADE, null=True, blank=True)

    player_left_local = models.CharField(max_length=50, null=True, blank=True)
    player_right_local = models.CharField(max_length=50, null=True, blank=True)

    ready_left = models.BooleanField(default=False)
    ready_right = models.BooleanField(default=False)

    def __str__(self):
        return f"GameSession {self.id} (status={self.status})"


class GameParameters(models.Model):
    """
    Paramètres de jeu associés à une GameSession.
    """
    BALL_SPEED_CHOICES = [(1, 'Slow'), (2, 'Medium'), (3, 'Fast')]
    PADDLE_SIZE_CHOICES = [(1, 'Small'), (2, 'Medium'), (3, 'Large')]

    game_session = models.OneToOneField(GameSession, related_name='parameters', on_delete=models.CASCADE)
    ball_speed = models.PositiveSmallIntegerField(choices=BALL_SPEED_CHOICES, default=2)
    paddle_size = models.PositiveSmallIntegerField(choices=PADDLE_SIZE_CHOICES, default=2)
    bonus_enabled = models.BooleanField(default=True)
    obstacles_enabled = models.BooleanField(default=False)

    def __str__(self):
        return (f"Ball speed: {self.get_ball_speed_display()}, "
                f"Paddle size: {self.get_paddle_size_display()}, "
                f"Bonus: {'On' if self.bonus_enabled else 'Off'}, "
                f"Obstacles: {'On' if self.obstacles_enabled else 'Off'}")


class GameResultManager(models.Manager):
    """
    Manager pour récupérer l'historique des matchs d'un utilisateur.
    """
    def get_user_match_history(self, user):
        return self.get_queryset().filter(
            models.Q(game__player_left=user) | models.Q(game__player_right=user)
        ).order_by('-ended_at')


class GameResult(models.Model):
    """
    Enregistre le résultat d'une partie terminée.
    """
    game = models.OneToOneField("GameSession", on_delete=models.CASCADE)
    winner = models.ForeignKey(User, related_name='games_won', on_delete=models.CASCADE, null=True, blank=True)
    looser = models.ForeignKey(User, related_name='games_lost', on_delete=models.CASCADE, null=True, blank=True)
    winner_local = models.CharField(max_length=50, null=True, blank=True)
    looser_local = models.CharField(max_length=50, null=True, blank=True)
    score_left = models.IntegerField()
    score_right = models.IntegerField()
    ended_at = models.DateTimeField(auto_now_add=True)

    objects = GameResultManager()

    def __str__(self):
        return f"[{self.game.id}] Winner: {self.winner or self.winner_local}, Loser: {self.looser or self.looser_local} ({self.score_left}-{self.score_right})"


# -------------------
# TOURNAMENT MODELS
# -------------------

class LocalTournament(models.Model):
    """
    Représente un tournoi local (4 joueurs, 2 demi-finales et une finale).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, default="Local Tournament")
    player1 = models.CharField(max_length=50, default='mbappe')
    player2 = models.CharField(max_length=50, default='zizou')
    player3 = models.CharField(max_length=50, default='ribery')
    player4 = models.CharField(max_length=50, default='cantona')

    semifinal1 = models.ForeignKey("GameSession", on_delete=models.SET_NULL, null=True, blank=True, related_name="tournament_semifinal1")
    semifinal2 = models.ForeignKey("GameSession", on_delete=models.SET_NULL, null=True, blank=True, related_name="tournament_semifinal2")
    final = models.ForeignKey("GameSession", on_delete=models.SET_NULL, null=True, blank=True, related_name="tournament_final")

    winner_semifinal_1 = models.CharField(max_length=50, null=True, blank=True)
    winner_semifinal_2 = models.CharField(max_length=50, null=True, blank=True)
    winner_final = models.CharField(max_length=50, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(
        max_length=30,
        default="pending",
        help_text="Ex: 'pending', 'semifinal1_in_progress', 'semifinal2_in_progress', 'final_in_progress', 'finished', etc."
    )

    def get_winner(self):
        return self.winner_final if self.status == "finished" else None

    def __str__(self):
        return f"Tournament {self.name} - {self.id}"


class TournamentParameters(models.Model):
    """
    Paramètres applicables à toutes les parties d'un tournoi.
    """
    tournament = models.OneToOneField(LocalTournament, on_delete=models.CASCADE, related_name='parameters')
    BALL_SPEED_CHOICES = [(1, 'Slow'), (2, 'Medium'), (3, 'Fast')]
    ball_speed = models.PositiveSmallIntegerField(choices=BALL_SPEED_CHOICES, default=2)
    PADDLE_SIZE_CHOICES = [(1, 'Small'), (2, 'Medium'), (3, 'Large')]
    paddle_size = models.PositiveSmallIntegerField(choices=PADDLE_SIZE_CHOICES, default=2)
    bonus_enabled = models.BooleanField(default=True)
    obstacles_enabled = models.BooleanField(default=False)

    def __str__(self):
        return (f"TournamentParameters for {self.tournament} | "
                f"Ball speed: {self.get_ball_speed_display()}, "
                f"Racket size: {self.get_paddle_size_display()}, "
                f"Bonus: {self.bonus_enabled}, Obstacles: {self.obstacles_enabled}")


# -------------------
# INVITATION MODELS
# -------------------

def default_expiration_time():
    """Retourne la date actuelle + 30 secondes."""
    return now() + timedelta(seconds=30)

class GameInvitation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    from_user = models.ForeignKey(User, related_name='invitations_sent', on_delete=models.CASCADE)
    to_user = models.ForeignKey(User, related_name='invitations_received', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(default=default_expiration_time)
    status = models.CharField(
        max_length=10,
        choices=[('pending', 'Pending'), ('accepted', 'Accepted'), ('rejected', 'Rejected'), ('expired', 'Expired')],
        default='pending',
    )
    session = models.ForeignKey("GameSession", null=True, blank=True, on_delete=models.SET_NULL, related_name='invitations')

    def is_expired(self):
        return now() > self.expires_at

    def __str__(self):
        if self.status == 'expired':
            return f"Invitation expirée de {self.from_user.username} à {self.to_user.username}"
        return f"Invitation de {self.from_user.username} à {self.to_user.username} - {self.status}"
