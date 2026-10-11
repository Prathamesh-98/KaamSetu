"""KaamSetu — Upload Routes"""
import asyncio
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from app.api.dependencies import get_current_user
from app.models.models import User
from app.services import cloudinary_service

router = APIRouter(tags=["Uploads"])

ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
ALLOWED_FOLDERS = {"kaamsetu/workers", "kaamsetu/employers", "kaamsetu/jobs"}

@router.post("/upload/image", status_code=201)
async def upload_image(
    file: UploadFile = File(...),
    folder: str = Form(...),
    current_user: User = Depends(get_current_user),
):
    """Uploads an image to Cloudinary securely."""
    if not cloudinary_service.is_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Image upload service is not configured.",
        )

    if folder not in ALLOWED_FOLDERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid folder destination.",
        )

    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type. Only JPEG, PNG, and WebP are allowed.",
        )

    # Read and check size
    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is too large. Maximum size is 5MB.",
        )

    try:
        result = await asyncio.to_thread(cloudinary_service.upload_image, file_bytes, folder)
        return {"url": result["url"], "public_id": result["public_id"]}
    except ValueError as ve:
        raise HTTPException(status_code=503, detail=str(ve))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload image. Please try again later.",
        )
