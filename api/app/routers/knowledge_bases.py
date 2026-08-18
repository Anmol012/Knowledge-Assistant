from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db
from app.schemas import KnowledgeBaseIn, KnowledgeBaseOut, KnowledgeBaseUpdate
from rag_lib.celery_app import celery_app
from rag_lib.models import Document, KnowledgeBase, User

router = APIRouter(prefix="/knowledge-bases", tags=["knowledge-bases"])


def _with_doc_count(db: Session, kb: KnowledgeBase) -> KnowledgeBaseOut:
    count = (
        db.query(Document)
        .filter(Document.knowledge_base_id == kb.id, Document.user_id == kb.user_id)
        .count()
    )
    return KnowledgeBaseOut(
        id=kb.id,
        name=kb.name,
        description=kb.description,
        document_count=count,
        created_at=kb.created_at,
    )


@router.post("", response_model=KnowledgeBaseOut, status_code=status.HTTP_201_CREATED)
def create_knowledge_base(
    payload: KnowledgeBaseIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    kb = KnowledgeBase(user_id=user.id, name=payload.name, description=payload.description)
    db.add(kb)
    db.commit()
    db.refresh(kb)
    return _with_doc_count(db, kb)


@router.get("", response_model=list[KnowledgeBaseOut])
def list_knowledge_bases(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    kbs = (
        db.query(KnowledgeBase)
        .filter(KnowledgeBase.user_id == user.id)
        .order_by(KnowledgeBase.created_at.desc())
        .all()
    )
    return [_with_doc_count(db, kb) for kb in kbs]


@router.patch("/{kb_id}", response_model=KnowledgeBaseOut)
def update_knowledge_base(
    kb_id: str,
    payload: KnowledgeBaseUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    kb = db.get(KnowledgeBase, kb_id)
    if kb is None or kb.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")

    if payload.name is not None:
        kb.name = payload.name
    if payload.description is not None:
        kb.description = payload.description
    db.commit()
    db.refresh(kb)
    return _with_doc_count(db, kb)


@router.delete("/{kb_id}", status_code=status.HTTP_202_ACCEPTED)
def delete_knowledge_base(
    kb_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    kb = db.get(KnowledgeBase, kb_id)
    if kb is None or kb.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")

    celery_app.send_task("delete_knowledge_base", args=[kb.id])
    return {"message": "Knowledge base deletion queued", "knowledge_base_id": kb.id}