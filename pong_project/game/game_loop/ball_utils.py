
from .redis_utils import get_key, set_key, delete_key
from .dimensions_utils import get_terrain_rect
import time
import math
import random
import asyncio
from game.tasks import register_subtask

BALL_MIN_SPEED = 1
BALL_MAX_SPEED = 20

def move_ball(game_id, ball):
    ball.x = float(get_key(game_id, "ball_x")) + float(get_key(game_id, "ball_vx"))
    ball.y = float(get_key(game_id, "ball_y")) + float(get_key(game_id, "ball_vy"))
    update_ball_redis(game_id, ball)


def reset_ball(game_id, ball):
    terrain_rect = get_terrain_rect(game_id)
    center_x = terrain_rect['left'] + terrain_rect['width'] // 2
    center_y = terrain_rect['top'] + terrain_rect['height'] // 2

    
    speed_multiplier = int(get_key(game_id, "initial_ball_speed_multiplier"))
    initial_speed_x = random.choice([-1, 1]) * speed_multiplier  
    initial_speed_y = random.choice([-1, 1]) * speed_multiplier

    ball.reset(center_x, center_y, initial_speed_x, initial_speed_y) 
    update_ball_redis(game_id, ball)

    print(f"[game_loop.py] Ball reset to ({ball.x}, {ball.y}) with speed ({ball.speed_x}, {ball.speed_y})")



def move_ball_sticky(game_id, paddle_left, paddle_right, ball):
    stuck_side = get_key(game_id, "ball_stuck_side").decode('utf-8')  
    
    
    if stuck_side == 'left':
        current_paddle = paddle_left
    else:
        current_paddle = paddle_right

    
    rel_pos = float(get_key(game_id, f"sticky_relative_pos_{stuck_side}") or 0)

    
    
    if stuck_side == 'left':
        ball.x = current_paddle.x + current_paddle.width + ball.size
    else:
        ball.x = current_paddle.x - ball.size

    
    ball.y = current_paddle.y + rel_pos

    
    start_t = float(get_key(game_id, f"sticky_start_time_{stuck_side}") or 0)
    if time.time() - start_t >= 1.0:
        
        release_ball_sticky(game_id, current_paddle, stuck_side, ball)




def stick_ball_to_paddle(game_id, stuck_side, current_paddle, ball):
    """
    Colle la balle sur la raquette <stuck_side>.
    """
    print(f"[sticky] stick ball to {stuck_side} paddle")
    
    relative_pos = ball.y - current_paddle.y

    
    set_key(game_id, "ball_original_vx", ball.speed_x)
    set_key(game_id, "ball_original_vy", ball.speed_y)

    
    set_key(game_id, "ball_stuck", 1)
    set_key(game_id, "ball_stuck_side", stuck_side)
    set_key(game_id, f"sticky_relative_pos_{stuck_side}", relative_pos)
    set_key(game_id, f"sticky_start_time_{stuck_side}", time.time())

    
    ball.speed_x = 0
    ball.speed_y = 0

    
    if stuck_side == 'left':
        ball.x = current_paddle.x + current_paddle.width + ball.size
    else:
        ball.x = current_paddle.x - ball.size

def release_ball_sticky(game_id, current_paddle, stuck_side, ball):
    print(f"[sticky] Releasing ball from {stuck_side} paddle")
    

    
    ball.speed_x = float(get_key(game_id, "ball_original_vx") or BALL_MIN_SPEED)
    ball.speed_y = float(get_key(game_id, "ball_original_vy") or BALL_MIN_SPEED)

    
    set_key(game_id, "ball_speed_boosted", 1)
    

    
    delete_key(game_id, "ball_stuck")
    delete_key(game_id, "ball_stuck_side")
    delete_key(game_id, f"sticky_relative_pos_{stuck_side}")
    delete_key(game_id, f"sticky_start_time_{stuck_side}")
    delete_key(game_id, "ball_original_vx")
    delete_key(game_id, "ball_original_vy")

    
    delete_key(game_id, f"paddle_{stuck_side}_sticky")



def manage_ball_speed_and_angle(game_id, current_paddle, paddle_side, ball):
    
    ball_already_boosted = get_key(game_id, "ball_speed_already_boosted")
    ball_speed_boosted = get_key(game_id, "ball_speed_boosted")
    if ball_already_boosted and ball_already_boosted.decode('utf-8') == '1':
        ball.speed_x = float(get_key(game_id, "ball_speed_x_before_boost") or BALL_MIN_SPEED)
        ball.speed_y = float(get_key(game_id, "ball_speed_y_before_boost") or BALL_MIN_SPEED)
        delete_key(game_id, "ball_speed_x_before_boost")
        delete_key(game_id, "ball_speed_y_before_boost")
        delete_key(game_id, "ball_speed_already_boosted")
    
    if ball_speed_boosted and ball_speed_boosted.decode('utf-8') == '1':
        set_key(game_id, "ball_speed_x_before_boost", ball.speed_x)
        set_key(game_id, "ball_speed_y_before_boost", ball.speed_y)
        set_key(game_id, "ball_speed_already_boosted", 1)
        delete_key(game_id, "ball_speed_boosted")
        tmp_speed = math.hypot(ball.speed_x, ball.speed_y) * 2
    else :
        tmp_speed = math.hypot(ball.speed_x, ball.speed_y) + 0.3
    
    
    new_speed = max(BALL_MIN_SPEED, min(BALL_MAX_SPEED, tmp_speed)) 

    
    relative_y = (ball.y - (current_paddle.y + current_paddle.height / 2)) / (current_paddle.height / 2)
    relative_y = max(-1, min(1, relative_y))  
    angle = relative_y * (math.pi / 4)  

    
    new_speed_x = new_speed * math.cos(angle)
    if paddle_side == 'left':
        ball.speed_x = new_speed_x
    else:
        ball.speed_x = -new_speed_x

    ball.speed_y = new_speed * math.sin(angle)



def update_ball_redis(game_id, ball):
    set_key(game_id, "ball_x", ball.x)
    set_key(game_id, "ball_y", ball.y)
    set_key(game_id, "ball_vx", ball.speed_x)
    set_key(game_id, "ball_vy", ball.speed_y)