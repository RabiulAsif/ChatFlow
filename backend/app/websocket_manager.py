from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        # Store active WebSocket connections.
        self.active_connections: dict[int, WebSocket] = {}


    async def connect(
        self,
        user_id: int,
        websocket: WebSocket
    ):
        # Accept WebSocket connection.
        await websocket.accept()

        # Save user's connection.
        self.active_connections[user_id] = websocket

        print(
            f"User {user_id} connected to WebSocket"
        )


    def disconnect(
        self,
        user_id: int
    ):
        # Remove user's connection.
        if user_id in self.active_connections:

            del self.active_connections[user_id]

            print(
                f"User {user_id} disconnected from WebSocket"
            )


    def is_online(
        self,
        user_id: int
    ) -> bool:
        # Check whether user is online.
        return user_id in self.active_connections


    async def send_personal_message(
        self,
        message,
        user_id: int
    ):
        # Check whether user is online.
        if user_id in self.active_connections:

            websocket = self.active_connections[user_id]

            # Send JSON message.
            await websocket.send_json(message)