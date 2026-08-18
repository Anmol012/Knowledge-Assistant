import httpx

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db
from app.schemas import ProviderConfigIn, ProviderConfigOut
from app.security import decrypt_secret, encrypt_secret
from rag_lib.models import ProviderConfig, User
from rag_lib.providers import (
    SUPPORTED_PROVIDERS,
    default_ollama_base_url,
    get_models,
    resolve_model,
)

router = APIRouter(prefix="/providers", tags=["providers"])


def _mask_key(api_key: str) -> str:
    if not api_key:
        return "not required"
    if len(api_key) <= 8:
        return "****"
    return f"{api_key[:4]}****{api_key[-4:]}"


def _to_out(config: ProviderConfig) -> ProviderConfigOut:
    return ProviderConfigOut(
        provider=config.provider,
        model=config.model,
        api_key_masked=_mask_key(decrypt_secret(config.api_key_encrypted) if config.api_key_encrypted else ""),
        base_url=config.base_url,
        updated_at=config.updated_at,
    )


@router.get("", response_model=list[ProviderConfigOut])
def list_providers(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    configs = (
        db.query(ProviderConfig)
        .filter(ProviderConfig.user_id == user.id)
        .order_by(ProviderConfig.updated_at.desc())
        .all()
    )
    return [_to_out(c) for c in configs]


@router.get("/models", response_model=dict)
def list_provider_models(
    provider: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    provider = provider.lower().strip()
    if provider not in SUPPORTED_PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported provider. Supported: {sorted(SUPPORTED_PROVIDERS)}",
        )

    base_url = None
    if provider == "ollama":
        config = (
            db.query(ProviderConfig)
            .filter(ProviderConfig.user_id == user.id, ProviderConfig.provider == "ollama")
            .first()
        )
        base_url = config.base_url if config and config.base_url else default_ollama_base_url()

    try:
        models = get_models(provider, base_url)
    except httpx.HTTPError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not reach {provider} server to list models",
        )

    return {"provider": provider, "base_url": base_url, "models": models}


@router.put("", response_model=ProviderConfigOut)
def upsert_provider(
    payload: ProviderConfigIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    provider = payload.provider.lower().strip()
    if provider not in SUPPORTED_PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported provider. Supported: {sorted(SUPPORTED_PROVIDERS)}",
        )

    if provider == "ollama":
        if not payload.base_url and not payload.api_key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Provide an external Ollama base URL (e.g. http://host:11434)",
            )
    elif not payload.api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="API key is required for this provider",
        )

    model = resolve_model(provider, payload.model)

    config = (
        db.query(ProviderConfig)
        .filter(ProviderConfig.user_id == user.id, ProviderConfig.provider == provider)
        .first()
    )
    if config is None:
        config = ProviderConfig(user_id=user.id, provider=provider)
        db.add(config)

    if payload.api_key is not None:
        config.api_key_encrypted = encrypt_secret(payload.api_key)
    elif provider == "ollama":
        config.api_key_encrypted = encrypt_secret("")
    if payload.base_url is not None:
        config.base_url = payload.base_url
    config.model = model
    db.commit()
    db.refresh(config)

    return _to_out(config)


@router.delete("/{provider}", status_code=status.HTTP_200_OK)
def delete_provider(
    provider: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    provider = provider.lower().strip()
    config = (
        db.query(ProviderConfig)
        .filter(ProviderConfig.user_id == user.id, ProviderConfig.provider == provider)
        .first()
    )
    if config is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not configured")

    db.delete(config)
    db.commit()
    return {"message": "Provider configuration removed", "provider": provider}