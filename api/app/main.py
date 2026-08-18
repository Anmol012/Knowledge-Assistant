from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import admin, auth, chat, documents, knowledge_bases, providers
from rag_lib.config import settings
from rag_lib.database import run_migrations
from rag_lib.vector_store import ensure_collection

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="Enterprise RAG platform: FastAPI + LangGraph + Qdrant + Celery",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    run_migrations()
    ensure_collection()


app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(documents.router, prefix=settings.api_prefix)
app.include_router(chat.router, prefix=settings.api_prefix)
app.include_router(providers.router, prefix=settings.api_prefix)
app.include_router(knowledge_bases.router, prefix=settings.api_prefix)
app.include_router(admin.router, prefix=settings.api_prefix)


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.get("/")
def root():
    return {"service": settings.app_name, "docs": "/docs", "health": "/health"}