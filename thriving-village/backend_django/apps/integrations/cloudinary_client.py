"""Direct Cloudinary SDK calls for the apply/enter upload flow, mirroring
Strapi's `provider: 'cloudinary'` upload-plugin config (backend/config/
plugins.ts) — same Cloudinary account/credentials, reused as-is per the
approved plan (no new accounts).

Strapi's plugin stores a Strapi "media" row pointing at the resulting
Cloudinary URL; Django just stores {url, name, size} directly on the
JobApplication/ContestEntry row (cv_url/cv_name/cv_size, work_url/work_name/
work_size) — there's no separate generic media table to replicate since
nothing else in this app needs one.
"""

import cloudinary
import cloudinary.uploader
from django.conf import settings

_configured = False


def _ensure_configured():
    global _configured
    if _configured:
        return
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True,
    )
    _configured = True


def upload_file(file, folder: str) -> dict:
    """`file` is a Django `UploadedFile` (from request.FILES). Returns
    {url, name, size, public_id} — matches the shape job/contest controllers
    expose for `cv`/`work` in the applicants/admin views."""
    _ensure_configured()
    result = cloudinary.uploader.upload(
        file,
        folder=folder,
        resource_type="auto",
        use_filename=True,
        unique_filename=True,
    )
    return {
        "url": result["secure_url"],
        "name": file.name,
        "size": file.size,
        "public_id": result["public_id"],
    }


def delete_file(public_id: str) -> None:
    if not public_id:
        return
    _ensure_configured()
    cloudinary.uploader.destroy(public_id, invalidate=True)
