import cloudinary
import cloudinary.uploader
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

# Configure Cloudinary if credentials exist
if settings.CLOUDINARY_CLOUD_NAME and settings.CLOUDINARY_API_KEY and settings.CLOUDINARY_API_SECRET:
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True,
    )
    is_configured = True
else:
    logger.warning("Cloudinary credentials are not fully configured.")
    is_configured = False


def upload_image(file_bytes: bytes, folder: str) -> dict:
    """
    Uploads an image to Cloudinary and returns the URL and public ID.
    Raises Exception if configuration is missing or upload fails.
    """
    if not is_configured:
        raise ValueError("Image upload service is not configured.")

    try:
        response = cloudinary.uploader.upload(
            file_bytes,
            folder=folder,
            resource_type="image",
        )
        return {
            "url": response.get("secure_url"),
            "public_id": response.get("public_id"),
        }
    except Exception as e:
        logger.error(f"Cloudinary upload error: {str(e)}")
        raise e
