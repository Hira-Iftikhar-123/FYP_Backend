from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from src.user_initiated_alert import schemas, service, utils

router = APIRouter()

@router.post("/", response_model=schemas.UserInitiatedAlertResponseSchema)
async def create_notification(data: schemas.UserInitiatedAlertCreateSchema):
    record = await service.create_alert(data)
    await utils.manager.broadcast(f"New alert: {record}")
    return record

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await utils.manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(f"You wrote: {data}")
    except WebSocketDisconnect:
        utils.manager.disconnect(websocket)
