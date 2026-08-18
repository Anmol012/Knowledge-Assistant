import httpx
import litellm

from rag_lib.config import settings

SUPPORTED_PROVIDERS = {
    "openai",
    "anthropic",
    "groq",
    "gemini",
    "azure",
    "mistral",
    "together",
    "ollama",
}

DEFAULT_MODELS = {
    "openai": "gpt-4o-mini",
    "anthropic": "claude-3-5-haiku-latest",
    "groq": "llama3-8b-8192",
    "gemini": "gemini-1.5-flash",
    "azure": "gpt-4o-mini",
    "mistral": "mistral-small-latest",
    "together": "meta-llama/Llama-3.1-8B-Instruct-Turbo",
    "ollama": settings.ollama_model,
}

CURATED_MODELS = {
    "openai": ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo", "o1-mini"],
    "anthropic": [
        "claude-3-5-sonnet-latest",
        "claude-3-5-haiku-latest",
        "claude-3-opus-latest",
        "claude-3-sonnet-latest",
        "claude-3-haiku-latest",
    ],
    "groq": [
        "llama3-8b-8192",
        "llama3-70b-8192",
        "llama-3.1-8b-instant",
        "mixtral-8x7b-32768",
        "gemma2-9b-it",
    ],
    "gemini": ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash"],
    "azure": ["gpt-4o", "gpt-4o-mini", "gpt-4"],
    "mistral": ["mistral-large-latest", "mistral-small-latest", "open-mistral-nemo"],
    "together": [
        "meta-llama/Llama-3.1-405B-Instruct-Turbo",
        "meta-llama/Llama-3.1-70B-Instruct-Turbo",
        "meta-llama/Llama-3.1-8B-Instruct-Turbo",
    ],
}


def is_supported(provider: str) -> bool:
    return provider in SUPPORTED_PROVIDERS


def resolve_model(provider: str, model: str | None) -> str:
    return (model or "").strip() or DEFAULT_MODELS.get(provider, "")


def default_ollama_base_url() -> str:
    return f"http://{settings.ollama_host}:{settings.ollama_port}"


def get_ollama_models(base_url: str | None = None) -> list[str]:
    url = (base_url or default_ollama_base_url()).rstrip("/") + "/api/tags"
    with httpx.Client(timeout=15.0) as client:
        response = client.get(url)
        response.raise_for_status()
        return [model.get("name", "") for model in response.json().get("models", []) if model.get("name")]


def get_models(provider: str, base_url: str | None = None) -> list[str]:
    if provider == "ollama":
        return get_ollama_models(base_url)
    return CURATED_MODELS.get(provider, [])


def generate(
    provider: str,
    model: str,
    messages: list[dict],
    api_key: str | None = None,
    base_url: str | None = None,
    temperature: float = settings.llm_temperature,
    max_tokens: int = settings.llm_max_tokens,
) -> str:
    kwargs: dict = {}
    if provider == "ollama":
        kwargs["api_base"] = (base_url or default_ollama_base_url()).rstrip("/")
        kwargs["api_key"] = "ollama"
    elif api_key:
        kwargs["api_key"] = api_key

    response = litellm.completion(
        model=f"{provider}/{model}",
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        **kwargs,
    )
    return response.choices[0].message.content or ""