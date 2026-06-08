import cloudinary
import cloudinary.uploader
from config.settings import settings

# ─── Configure Cloudinary ────────────────────────────────────────────────────
cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET,
)


def upload_profile_photo(file_bytes: bytes, public_id: str) -> str:
    """
    Upload provider profile photo to Cloudinary.
    Returns the secure URL of the uploaded image.
    """
    result = cloudinary.uploader.upload(
        file_bytes,
        public_id=public_id,
        folder="sigslot/providers",
        overwrite=True,
        resource_type="image",
        transformation=[
            {"width": 400, "height": 400, "crop": "fill", "gravity": "face"},
            {"quality": "auto", "fetch_format": "auto"},
        ],
    )
    return result.get("secure_url", "")


def delete_profile_photo(public_id: str) -> None:
    """Remove a provider's photo from Cloudinary."""
    cloudinary.uploader.destroy(f"sigslot/providers/{public_id}")
