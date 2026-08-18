import os

import PyPDF2

from rag_lib.celery_app import celery_app
from rag_lib.chunking import chunk_text
from rag_lib.config import settings
from rag_lib.database import SessionLocal
from rag_lib.embeddings import get_embeddings
from rag_lib.models import Document, DocumentStatus, KnowledgeBase
from rag_lib.vector_store import (
    delete_document_vectors,
    delete_knowledge_base_vectors,
    ensure_collection,
    upsert_chunks,
)


def extract_text(file_path: str, file_type: str) -> str:
    if file_type == "pdf":
        text = ""
        with open(file_path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                text += page.extract_text() or ""
        return text
    if file_type in ("txt", "md"):
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    raise ValueError(f"Unsupported file type: {file_type}")


@celery_app.task(bind=True, name="ingest_document")
def ingest_document(self, document_id: str) -> dict:
    db = SessionLocal()
    try:
        doc = db.get(Document, document_id)
        if doc is None:
            return {"ok": False, "error": "document not found"}

        doc.status = DocumentStatus.processing
        db.commit()

        text = extract_text(doc.file_path, doc.file_type)
        chunks = chunk_text(text, chunk_size=settings.chunk_size, overlap=settings.chunk_overlap)
        if not chunks:
            doc.status = DocumentStatus.failed
            doc.error = "No extractable text found in file"
            db.commit()
            return {"ok": False, "error": doc.error}

        embeddings = get_embeddings(chunks)
        ensure_collection()
        upsert_chunks(doc.user_id, doc.knowledge_base_id, doc.id, doc.filename, chunks, embeddings)

        doc.chunk_count = len(chunks)
        doc.status = DocumentStatus.ready
        doc.error = None
        db.commit()
        return {"ok": True, "chunk_count": len(chunks)}
    except Exception as exc:
        db.rollback()
        doc = db.get(Document, document_id)
        if doc is not None:
            doc.status = DocumentStatus.failed
            doc.error = str(exc)
            db.commit()
        return {"ok": False, "error": str(exc)}
    finally:
        db.close()


@celery_app.task(bind=True, name="delete_knowledge_base")
def delete_knowledge_base(self, knowledge_base_id: str) -> dict:
    db = SessionLocal()
    try:
        kb = db.get(KnowledgeBase, knowledge_base_id)
        if kb is None:
            return {"ok": False, "error": "knowledge base not found"}

        docs = (
            db.query(Document)
            .filter(Document.knowledge_base_id == kb.id, Document.user_id == kb.user_id)
            .all()
        )
        delete_knowledge_base_vectors(kb.user_id, kb.id)
        for doc in docs:
            if doc.file_path and os.path.exists(doc.file_path):
                os.remove(doc.file_path)
            db.delete(doc)
        db.delete(kb)
        db.commit()
        return {"ok": True, "documents_deleted": len(docs)}
    except Exception as exc:
        db.rollback()
        return {"ok": False, "error": str(exc)}
    finally:
        db.close()


@celery_app.task(bind=True, name="delete_document")
def delete_document(self, document_id: str) -> dict:
    db = SessionLocal()
    try:
        doc = db.get(Document, document_id)
        if doc is None:
            return {"ok": False, "error": "document not found"}

        delete_document_vectors(doc.user_id, doc.id)

        if doc.file_path and os.path.exists(doc.file_path):
            os.remove(doc.file_path)

        db.delete(doc)
        db.commit()
        return {"ok": True}
    except Exception as exc:
        db.rollback()
        return {"ok": False, "error": str(exc)}
    finally:
        db.close()