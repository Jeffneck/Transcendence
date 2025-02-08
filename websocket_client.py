import websocket
import json
import argparse
import time

# Fonction pour gérer la réception de messages
def on_message(ws, message):
    print(f"Reçu: {message}")

# Fonction pour gérer l'ouverture de la connexion WebSocket
def on_open(ws):
    print("Connexion établie")
    
    # Démarre la boucle de mouvement des paddles
    move_paddles(ws)

# Fonction pour gérer la fermeture de la connexion WebSocket
def on_close(ws, close_status_code, close_msg):
    print(f"Connexion fermée ({close_status_code}): {close_msg}")

# Fonction pour envoyer des commandes de mouvement au serveur
def move_paddles(ws):
    user_role = "left"  # Choisissez le rôle ici, par exemple "left" ou "right"
    while True:
        # Déplacer le paddle vers le haut
        ws.send(json.dumps({
            "action": "start_move",
            "player": user_role,
            "direction": "up"
        }))
        time.sleep(1)  # Attendre 1 seconde avant de changer de direction
        
        # Arrêter le mouvement du paddle
        ws.send(json.dumps({
            "action": "stop_move",
            "player": user_role
        }))
        time.sleep(1)
        
        # Déplacer le paddle vers le bas
        ws.send(json.dumps({
            "action": "start_move",
            "player": user_role,
            "direction": "down"
        }))
        time.sleep(1)  # Attendre 1 seconde avant de changer de direction
        
        # Arrêter le mouvement du paddle
        ws.send(json.dumps({
            "action": "stop_move",
            "player": user_role
        }))
        time.sleep(1)

def main():
    # pip install websocket-client #pour communiquer avec le websocket du jeu via un client
    # python websocket_client.py <game_id>

    parser = argparse.ArgumentParser(description="WebSocket Client CLI")
    parser.add_argument("game_id", help="ID du jeu pour le WebSocket")
    args = parser.parse_args()

    # Construire l'URL WebSocket
    protocol = "wss:" if input("window.location.protocol === 'https:'") else "ws:"
    ws_url = f"{protocol}//{input('window.location.host')}/ws/pong/{args.game_id}/"

    # Initialiser et connecter WebSocket
    websocket.enableTrace(True)
    ws = websocket.WebSocketApp(ws_url, on_message=on_message, on_open=on_open, on_close=on_close)
    ws.run_forever()

if __name__ == "__main__":
    main()
