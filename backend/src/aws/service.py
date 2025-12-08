# app/services/s3_service.py
import boto3
from botocore.exceptions import ClientError
from fastapi import UploadFile
from typing import Optional
import uuid
import asyncio
from src.aws.schemas import settings
from src.models import EventMedia
from db import SessionLocal

s3_client = boto3.client(
    "s3",
    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    region_name=settings.AWS_REGION,
)

async def upload_file_to_s3(file: UploadFile, alert_id: int, folder: Optional[str] = None) -> str:

    file_extension = file.filename.split(".")[-1]
    unique_name = f"{uuid.uuid4()}.{file_extension}"
    print(file_extension, unique_name)

    key = f"{folder}/{unique_name}" if folder else unique_name
    print(key)

    file_bytes = await file.read()

    loop = asyncio.get_event_loop()
    try:
        await loop.run_in_executor(
            None,
            lambda: s3_client.put_object(
                Bucket=settings.AWS_S3_BUCKET_NAME,
                Key=key,
                Body=file_bytes,
                ContentType=file.content_type,
            )
        )
    except ClientError as e:
        raise Exception(f"Upload to S3 failed: {e}")
    
    event_media = EventMedia(
        media_url=key,            
        media_type=file.content_type,
        alert_id=alert_id
    )

    try:
        db = SessionLocal()
        db.add(event_media)
        db.commit()
        db.refresh(event_media)
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()

    return key    

def get_s3_presigned_url(s3_key: str, expiration: int = 3600) -> str:
    try: 
        response = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': settings.AWS_S3_BUCKET_NAME, 'Key': s3_key},
            ExpiresIn=expiration
        )
        print(response)
        return response
    except ClientError as e:
        raise Exception(f"Generating presigned URL failed: {e}")
    return

async def retrieve_file(alert_id: int) -> Optional[str]:
    db=SessionLocal()
    try:
        media = db.query(EventMedia).filter(EventMedia.alert_id == alert_id).all()
        if media:
            s3_url = media[0].media_url
            return get_s3_presigned_url(s3_url)
    except Exception as e:
        return None
    finally:
        db.close()
    return None