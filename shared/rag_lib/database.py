from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

from rag_lib.config import settings

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_recycle=3600,
    pool_size=10,
    max_overflow=20,
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()


def init_db():
    from rag_lib import models  # noqa: F401

    Base.metadata.create_all(bind=engine)


def _column_exists(table: str, column: str) -> bool:
    with engine.connect() as conn:
        result = conn.execute(
            text(
                "SELECT COUNT(*) FROM information_schema.columns "
                "WHERE table_schema = DATABASE() AND table_name = :table AND column_name = :column"
            ),
            {"table": table, "column": column},
        )
        return result.scalar() > 0


def _add_column(table: str, column: str, definition: str) -> None:
    if not _column_exists(table, column):
        with engine.connect() as conn:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {definition}"))
            conn.commit()


def run_migrations():
    """Idempotent schema upgrades for databases created before new columns existed."""
    init_db()
    _add_column("documents", "knowledge_base_id", "VARCHAR(36) NULL")
    _add_column("chats", "provider", "VARCHAR(32) NULL")
    _add_column("chats", "model", "VARCHAR(128) NULL")
    _add_column("chats", "knowledge_base_ids", "JSON NULL")
    _add_column("provider_configs", "base_url", "VARCHAR(512) NULL")