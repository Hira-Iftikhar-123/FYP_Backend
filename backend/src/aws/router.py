from fastapi import APIRouter, UploadFile, File, Form
from src.aws.service import upload_file_to_s3, retrieve_file

router = APIRouter(prefix="/upload", tags=["Upload"])

@router.post("/file")
async def upload_file(file: UploadFile = File(...), alert_id: int = Form()):
    url = await upload_file_to_s3(file, alert_id, folder="uploads")

    return {"url": url}

@router.get("/file")
async def get_file_from_s3(alert_id: int = Form(...)):
    url = await retrieve_file(alert_id)
    if url:
        return {"url": url}
    return {"message": "File not found"}

