
from .redis_utils import get_key, set_key
from .dimensions_utils import get_terrain_rect



def move_paddles(game_id, paddle_left, paddle_right):
    
    left_vel = float(get_key(game_id, "paddle_left_velocity") or 0)
    right_vel = float(get_key(game_id, "paddle_right_velocity") or 0)

    
    initial_height = float(get_key(game_id, "initial_paddle_height"))

    
    new_left_height = float(get_key(game_id, "paddle_left_height") or initial_height)
    new_right_height = float(get_key(game_id, "paddle_right_height") or initial_height)

    
    is_left_inverted = bool(get_key(game_id, "paddle_left_inverted"))
    is_right_inverted = bool(get_key(game_id, "paddle_right_inverted"))
    is_left_on_ice = bool(get_key(game_id, "paddle_left_ice_effect"))
    is_right_on_ice = bool(get_key(game_id, "paddle_right_ice_effect"))
    has_left_speed_boost = bool(get_key(game_id, "paddle_left_speed_boost"))
    has_right_speed_boost = bool(get_key(game_id, "paddle_right_speed_boost"))

    
    paddle_left.height = new_left_height
    paddle_right.height = new_right_height

    
    
    if is_left_inverted:
        left_vel = -left_vel
    if is_right_inverted:
        right_vel = -right_vel

    
    if has_left_speed_boost:
        left_vel *= 1.5
    if has_right_speed_boost:
        right_vel *= 1.5

    
    
    
    
    direction_left = 0
    if left_vel > 0: direction_left = 1
    elif left_vel < 0: direction_left = -1

    direction_right = 0
    if right_vel > 0: direction_right = 1
    elif right_vel < 0: direction_right = -1

    
    terrain_top = 50
    terrain_bottom = 350

    
    
    paddle_left.move(direction_left, is_left_on_ice, terrain_top, terrain_bottom, speed_boost=has_left_speed_boost)
    paddle_right.move(direction_right, is_right_on_ice, terrain_top, terrain_bottom, speed_boost=has_right_speed_boost)

    
    set_key(game_id, "paddle_left_y", paddle_left.y)
    set_key(game_id, "paddle_right_y", paddle_right.y)
    























































