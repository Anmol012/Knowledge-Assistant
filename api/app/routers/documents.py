import os

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db
from app.schemas import DocumentOut, UploadResponse
from rag_lib.celery_app import celery_app
from rag_lib.config import settings
from rag_lib.models import Document, DocumentStatus, KnowledgeBase, User

router = APIRouter(prefix="/documents", tags=["documents"])

ALLOWED_TYPES = {
    "application/pdf": ("pdf", ".pdf"),
    "text/plain": ("txt", ".txt"),
    "text/markdown": ("md", ".md"),
}

MAX_UPLOAD_BYTES = settings.max_upload_size_mb * 1024 * 1024


def get_or_create_default_kb(db: Session, user_id: str) -> KnowledgeBase:
    kb = (
        db.query(KnowledgeBase)
        .filter(KnowledgeBase.user_id == user_id, KnowledgeBase.name == "Default")
        .first()
    )
    if kb is None:
        kb = KnowledgeBase(user_id=user_id, name="Default", description="Default knowledge base")
        db.add(kb)
        db.commit()
        db.refresh(kb)
    return kb


def _validate_kb(db: Session, user_id: str, knowledge_base_id: str) -> KnowledgeBase:
    kb = db.get(KnowledgeBase, knowledge_base_id)
    if kb is None or kb.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")
    return kb


@router.post("/upload", response_model=UploadResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_document(
    file: UploadFile = File(...),
    knowledge_base_id: str | None = Form(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    content_type = file.content_type or ""
    file_info = ALLOWED_TYPES.get(content_type)
    if file_info is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF, TXT and Markdown files are allowed",
        )
    file_type, extension = file_info

    contents = await file.read()
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum size of {settings.max_upload_size_mb}MB",
        )

    import uuid

    document_id = str(uuid.uuid4())
    user_dir = os.path.join(settings.upload_dir, user.id)
    os.makedirs(user_dir, exist_ok=True)
    file_path = os.path.join(user_dir, f"{document_id}{extension}")
    with open(file_path, "wb") as f:
        f.write(contents)

    if knowledge_base_id:
        kb = _validate_kb(db, user.id, knowledge_base_id)
        resolved_kb_id = kb.id
    else:
        resolved_kb_id = get_or_create_default_kb(db, user.id).id

    document = Document(
        id=document_id,
        user_id=user.id,
        knowledge_base_id=resolved_kb_id,
        filename=file.filename or f"upload{extension}",
        file_path=file_path,
        file_type=file_type,
        status=DocumentStatus.pending,
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    celery_app.send_task("ingest_document", args=[document.id])

    return UploadResponse(
        document_id=document.id,
        filename=document.filename,
        status=document.status,
        knowledge_base_id=document.knowledge_base_id,
    )


@router.get("", response_model=list[DocumentOut])
def list_documents(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return (
        db.query(Document)
        .filter(Document.user_id == user.id)
        .order_by(Document.created_at.desc())
        .all()
    )


@router.get("/{document_id}", response_model=DocumentOut)
def get_document(document_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    document = db.get(Document, document_id)
    if document is None or document.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return document


@router.delete("/{document_id}", status_code=status.HTTP_202_ACCEPTED)
def delete_document(document_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    document = db.get(Document, document_id)
    if document is None or document.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    celery_app.send_task("delete_document", args=[document.id])
    return {"message": "Document deletion queued", "document_id": document.id}