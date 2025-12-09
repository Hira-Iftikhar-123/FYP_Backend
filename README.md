To run the backend:
- Navigate to the backend directory
- run "uvicorn src.main:app"

ENDPOINTS:
 MODEL_ALERT ENDPOINTS
 POST - /model/api/v1/trigger-alert 
 payload: src.model_alert.schemas.TriggerAlertPayload

 POST - /model/api/v1/detect
 payload: payload: src.model_alert.schemas.DetectResponse

 USER_INITIATED_ALERT ENDPOINTS

 POST - /alerts/
 payload: src.user_initiated_alert.schemas.UserInitiatedAlertCreatSchema
 WEBSOCKET - /ws

 POST /aws/upload/file
 Payload: 
  file
  alert_id
GET /aws/upload_fule
  Payload:
    alert_id

POSTMAN: LINK
