import re
import secrets


def generate_token(nbytes: int = 32) -> str:
    return secrets.token_hex(nbytes)


def slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower().strip())
    return slug.strip("-")[:48] or "workspace"


async def unique_workspace_slug(base: str, exists) -> str:
    slug = slugify(base)
    suffix = 0
    while True:
        candidate = slug if suffix == 0 else f"{slug}-{suffix}"
        if not await exists(candidate):
            return candidate
        suffix += 1
