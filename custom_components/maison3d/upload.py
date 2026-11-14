"""Upload the main photo / weather images from the Home Assistant UI.

POST /api/maison3d/upload (administrators only), multipart field ``file`` and
optional ``name`` (suggested file name, e.g. ``neige-nuit``). The image is
saved in /config/www/maison3d/ and served at /maison3d-media/<file> (also
/local/maison3d/<file> when /config/www existed at startup).
"""
from __future__ import annotations

import re
import time
import unicodedata
from http import HTTPStatus
from pathlib import Path
from urllib.parse import unquote

from aiohttp import web

from homeassistant.components.http import KEY_HASS_USER, HomeAssistantView, StaticPathConfig
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import Unauthorized
from homeassistant.helpers.http import KEY_HASS

UPLOAD_URL = "/api/maison3d/upload"
MEDIA_URL = "/maison3d-media"
MAX_BYTES = 10 * 1024 * 1024
# extension -> (accepted content types, magic check)
FORMATS = {
    ".jpg": ({"image/jpeg", "image/jpg", "image/pjpeg"}, lambda b: b[:3] == b"\xff\xd8\xff"),
    ".png": ({"image/png"}, lambda b: b[:8] == b"\x89PNG\r\n\x1a\n"),
    ".webp": ({"image/webp"}, lambda b: b[:4] == b"RIFF" and b[8:12] == b"WEBP"),
}
EXTENSIONS = {".jpg": ".jpg", ".jpeg": ".jpg", ".png": ".png", ".webp": ".webp"}


def upload_dir(hass: HomeAssistant) -> Path:
    return Path(hass.config.path("www", "maison3d"))


def safe_name(hint: str, filename: str) -> tuple[str, str] | None:
    """Return (stem, extension) built only from [a-z0-9-], or None if not an image name."""
    filename = unquote(filename or "").replace("\\", "/").rsplit("/", 1)[-1]
    ext = EXTENSIONS.get(Path(filename).suffix.lower())
    if ext is None:
        return None
    base = hint or Path(filename).stem
    base = unquote(base).replace("\\", "/").rsplit("/", 1)[-1]
    base = unicodedata.normalize("NFKD", base).encode("ascii", "ignore").decode()
    stem = re.sub(r"[^a-z0-9]+", "-", base.lower()).strip("-")[:60].strip("-") or "photo"
    return stem, ext


def _write(directory: Path, name: str, data: bytes) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    target = (directory / name).resolve()
    if target.parent != directory.resolve():
        raise ValueError("path")
    tmp = target.with_suffix(target.suffix + ".part")
    tmp.write_bytes(data)
    tmp.replace(target)
    return target


class Maison3DUploadView(HomeAssistantView):
    """Receive one image and store it in /config/www/maison3d/."""

    url = UPLOAD_URL
    name = "api:maison3d:upload"
    requires_auth = True

    async def post(self, request: web.Request) -> web.Response:
        hass: HomeAssistant = request.app[KEY_HASS]
        user = request.get(KEY_HASS_USER)
        if user is None or not user.is_admin:
            raise Unauthorized()
        try:
            reader = await request.multipart()
        except (AssertionError, ValueError, KeyError):
            return self.json_message("multipart attendu", HTTPStatus.BAD_REQUEST)
        hint, filename, content_type, data = "", "", "", None
        async for part in reader:
            if part.name == "name":
                hint = (await part.text())[:80]
            elif part.name == "file" and data is None:
                filename = part.filename or ""
                content_type = (part.headers.get("Content-Type") or "").split(";")[0].strip().lower()
                chunks, size = [], 0
                while chunk := await part.read_chunk(65536):
                    size += len(chunk)
                    if size > MAX_BYTES:
                        return self.json_message("fichier trop gros (10 Mo max)", HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
                    chunks.append(chunk)
                data = b"".join(chunks)
        if not data:
            return self.json_message("aucun fichier", HTTPStatus.BAD_REQUEST)
        named = safe_name(hint, filename)
        if named is None:
            return self.json_message("format refusé (jpg, png ou webp)", HTTPStatus.UNSUPPORTED_MEDIA_TYPE)
        stem, ext = named
        types, magic = FORMATS[ext]
        if (content_type and content_type not in types) or not magic(data):
            return self.json_message("ce fichier n'est pas une image jpg, png ou webp", HTTPStatus.UNSUPPORTED_MEDIA_TYPE)
        name = stem + ext
        try:
            await hass.async_add_executor_job(_write, upload_dir(hass), name, data)
        except (OSError, ValueError):
            return self.json_message("enregistrement impossible", HTTPStatus.INTERNAL_SERVER_ERROR)
        version = int(time.time())
        return self.json({
            "url": f"{MEDIA_URL}/{name}?v={version}",
            "local_url": f"/local/maison3d/{name}",
            "file": name,
            "size": len(data),
        })


async def async_register_upload(hass: HomeAssistant) -> None:
    """Register the upload view and the static route serving the uploads."""
    directory = upload_dir(hass)
    await hass.async_add_executor_job(lambda: directory.mkdir(parents=True, exist_ok=True))
    await hass.http.async_register_static_paths([StaticPathConfig(MEDIA_URL, str(directory), False)])
    hass.http.register_view(Maison3DUploadView())
