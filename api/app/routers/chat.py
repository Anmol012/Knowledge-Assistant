from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.rag_graph import run_rag
from app.deps import get_current_user, get_db
from app.schemas import ChatOut, ChatRequest, ChatResponse, MessageOut, SourceRef
from rag_lib.models import Chat, ChatMessage, KnowledgeBase, MessageRole, User

router = APIRouter(prefix="/chat", tags=["chat"])


def _validate_kb_ids(db: Session, user_id: str, kb_ids: list[str]) -> list[str]:
    if not kb_ids:
        return []
    found = (
        db.query(KnowledgeBase.id)
        .filter(KnowledgeBase.user_id == user_id, KnowledgeBase.id.in_(kb_ids))
        .all()
    )
    found_ids = {row[0] for row in found}
    missing = set(kb_ids) - found_ids
    if missing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")
    return kb_ids


@router.post("", response_model=ChatResponse)
def chat(payload: ChatRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    kb_ids = _validate_kb_ids(db, user.id, payload.knowledge_base_ids or [])

    chat_id = payload.chat_id
    if chat_id is not None:
        chat = db.get(Chat, chat_id)
        if chat is None or chat.user_id != user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")
        if payload.provider is not None:
            chat.provider = payload.provider
        if payload.model is not None:
            chat.model = payload.model
        if payload.knowledge_base_ids is not None:
            chat.knowledge_base_ids = kb_ids
    else:
        chat = Chat(user_id=user.id, title=payload.message[:50])
        if payload.provider is not None:
            chat.provider = payload.provider
        if payload.model is not None:
            chat.model = payload.model
        if payload.knowledge_base_ids is not None:
            chat.knowledge_base_ids = kb_ids
        db.add(chat)
        db.commit()
        db.refresh(chat)
        chat_id = chat.id

    db.add(ChatMessage(chat_id=chat_id, role=MessageRole.user, content=payload.message))
    db.commit()

    try:
        result = run_rag(
            user.id,
            chat_id,
            payload.message,
            provider=payload.provider,
            model=payload.model,
            knowledge_base_ids=kb_ids or None,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Model request failed: {exc}",
        )

    answer = result.get("answer", "")
    sources = [
        SourceRef(filename=r["filename"], chunk_index=r["chunk_index"], snippet=r["text"][:200])
        for r in result.get("contexts", [])
    ]

    db.add(
        ChatMessage(
            chat_id=chat_id,
            role=MessageRole.assistant,
            content=answer,
            sources=[s.model_dump() for s in sources],
        )
    )
    db.commit()

    return ChatResponse(
        chat_id=chat_id,
        answer=answer,
        sources=sources,
        provider=result.get("provider"),
        model=result.get("model"),
        knowledge_base_ids=kb_ids,
    )


@router.get("", response_model=list[ChatOut])
def list_chats(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return (
        db.query(Chat)
        .filter(Chat.user_id == user.id)
        .order_by(Chat.created_at.desc())
        .all()
    )


@router.get("/{chat_id}/messages", response_model=list[MessageOut])
def chat_history(chat_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    chat = db.get(Chat, chat_id)
    if chat is None or chat.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")
    return (
        db.query(ChatMessage)
        .filter(ChatMessage.chat_id == chat_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )


@router.delete("/{chat_id}", status_code=status.HTTP_202_ACCEPTED)
def delete_chat(chat_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    chat = db.get(Chat, chat_id)
    if chat is None or chat.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")

    db.query(ChatMessage).filter(ChatMessage.chat_id == chat_id).delete()
    db.delete(chat)
    db.commit()
    return {"message": "Chat deleted", "chat_id": chat_id}