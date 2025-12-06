from fastapi import WebSocket, status, Query

async def get_token_from_socket(websocket: WebSocket, token: str=Query(...)):
    if token != "secrettoken":
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
    return token