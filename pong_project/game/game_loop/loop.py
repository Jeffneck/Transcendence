


import asyncio
import time
from django.conf import settings
from channels.layers import get_channel_layer

from .redis_utils import get_key
from .models_utils import get_gameSession_status, get_gameSession, is_online_gameSession, get_gameSession_parameters, set_gameSession_status
from .initialize_game import initialize_game_objects, initialize_redis
from .paddles_utils import move_paddles
from .ball_utils import move_ball, move_ball_sticky, reset_ball
from .collisions import (
    handle_scoring_or_paddle_collision,
    
    handle_border_collisions,
    handle_bumper_collision,
    handle_powerup_collision
)
from .score_utils import handle_score, winner_detected, finish_game, reset_all_objects
from .bumpers_utils import handle_bumpers_spawn, handle_bumper_expiration
from .powerups_utils import handle_powerups_spawn, handle_powerup_expiration
from .broadcast import broadcast_game_state, notify_countdown, notify_scored, notify_game_aborted

class WaitForPlayersTimeout(Exception):
    """Exception levée lorsqu'un délai d'attente est dépassé avant que les joueurs ne soient prêts."""
    pass

async def wait_for_players(game_id):
    print(f"[game_loop.py] wait_for_players {game_id}.")
    timeout = 30  
    start_time = time.time()
    
    
    while time.time() - start_time < timeout:
        gs = await get_gameSession(game_id)
        if gs.ready_left and gs.ready_right:
            print(f"[game_loop.py] wait_for_players Everyone is READY {game_id}.")
            return True
        await asyncio.sleep(0.1)  
    
    
    raise WaitForPlayersTimeout(f"Délai d'attente de {timeout} secondes dépassé pour game_id {game_id}.")


async def countdown_before_game(game_id):
    for countdown_nb in range(3, 0, -1):
        await notify_countdown(game_id, countdown_nb)
        await asyncio.sleep(1)





async def game_loop(game_id):
    """
    Boucle principale pour UNE partie identifiée par game_id.
    Tourne ~90 fois/s tant que la partie n'est pas 'finished'.
    """
    channel_layer = get_channel_layer()
    dt = 1/90
    print(f"[game_loop.py] Starting loop for game_id={game_id}.")
    try:
        await wait_for_players(game_id)
        
        parameters = await get_gameSession_parameters(game_id)


        
        paddle_left, paddle_right, ball, powerup_orbs, bumpers = initialize_game_objects(game_id, parameters)
        initialize_redis(game_id, paddle_left, paddle_right, ball, parameters)
        await countdown_before_game(game_id)
        

        
        
        
        
        while True:
            
            try :
                
                session_status = await get_gameSession_status(game_id)
                if session_status != 'running':
                    print(f"[game_loop] game_id={game_id} => statut={session_status}. Fin de la boucle.")
                    break

                current_time = time.time()

                
                move_paddles(game_id, paddle_left, paddle_right)

                
                stuck_flag = get_key(game_id, "ball_stuck")
                if stuck_flag and stuck_flag.decode('utf-8') == '1':
                    move_ball_sticky(game_id, paddle_left, paddle_right, ball)
                else :
                    move_ball(game_id, ball)
                
                
                await handle_border_collisions(game_id, ball)
                await handle_bumper_collision(game_id, ball, bumpers)
                await handle_powerup_collision(game_id, ball, powerup_orbs)
                

                
                scorer = await handle_scoring_or_paddle_collision(game_id, paddle_left, paddle_right, ball)
                if scorer in ['score_left', 'score_right']:
                    await reset_all_objects(game_id, powerup_orbs, bumpers) 
                    await notify_scored(game_id)
                    await asyncio.sleep(1.5)
                    handle_score(game_id, scorer)

                    
                    if winner_detected(game_id):
                        await finish_game(game_id)
                        break
                    else:
                        
                        reset_ball(game_id, ball)

                
                
                if parameters.bonus_enabled:
                    await handle_powerups_spawn(game_id, powerup_orbs, current_time, bumpers)
                    await handle_powerup_expiration(game_id, powerup_orbs)

                if parameters.obstacles_enabled:
                    await handle_bumpers_spawn(game_id, bumpers, current_time, powerup_orbs)
                    await handle_bumper_expiration(game_id, bumpers)
                
                
                
                
                await broadcast_game_state(game_id, channel_layer, paddle_left, paddle_right, ball, powerup_orbs, bumpers)

                
                
                await asyncio.sleep(dt)
            except asyncio.CancelledError:
                await set_gameSession_status(game_id, "cancelled")
                await notify_game_aborted(game_id)
                return

    except asyncio.CancelledError:
        print(f"[game_loop] => CANCELLED => on arrête la game {game_id}")
        
        await set_gameSession_status(game_id, "cancelled")
        await notify_game_aborted(game_id)
        return  
    
    except Exception as e:
        print(f"[game_loop] Exception pour game_id={game_id} : {e}")

    finally:
        print(f"[game_loop] Fin du game_loop pour game_id={game_id}.")