from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Enterprise Knowledge Assistant"
    api_prefix: str = "/api/v1"

    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    fernet_key: str = ""

    database_url: str = "mysql+pymysql://root:password@mysql:3306/ragdb?charset=utf8mb4"

    redis_url: str = "redis://redis:6379/0"
    celery_broker_url: str = "redis://redis:6379/0"
    celery_result_backend: str = "redis://redis:6379/1"

    qdrant_host: str = "qdrant"
    qdrant_port: int = 6333
    qdrant_collection: str = "documents"

    embedding_model: str = "all-MiniLM-L6-v2"
    embedding_dim: int = 384
    chunk_size: int = 1000
    chunk_overlap: int = 200
    top_k: int = 3
    memory_turns: int = 5

    default_provider: str = "ollama"
    ollama_host: str = "ollama"
    ollama_port: int = 11434
    ollama_model: str = "gemma:2b"
    llm_temperature: float = 0.7
    llm_max_tokens: int = 500

    upload_dir: str = "/app/uploads"
    max_upload_size_mb: int = 50

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()