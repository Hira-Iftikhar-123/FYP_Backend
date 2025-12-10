from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import firebase_admin
from firebase_admin import credentials
from src.user_initiated_alert.router import router as alert_router
from src.model_alert.router import router as model_alert_router
from src.aws.router import router as aws_router
import db as db
import os

app = FastAPI(title="Realtime Theft and Violence Detection")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*", 
    "http://192.168.1.18:8000",
    "ws://192.168.1.18:8000"],
    allow_methods=["*"],
    allow_headers=["*"]
)

@app.on_event("startup")
async def on_startup() -> None:
    if not firebase_admin._apps:
        try:
            _project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
            _firebase_creds_path = os.path.join(
                _project_root,
                "firebase_credentials.json",
            )
            if os.path.exists(_firebase_creds_path):
                cred = credentials.Certificate(_firebase_creds_path)
                firebase_admin.initialize_app(cred)
        except Exception:
            pass

@app.get("/")
async def read_root():
    return {"App": "Backend is running"}

app.include_router(alert_router, prefix="/alerts", tags=["User Initiated Alerts"])
app.include_router(model_alert_router, prefix="/model", tags=["Model Alert"])
app.include_router(aws_router, prefix="/aws", tags=["AWS"])