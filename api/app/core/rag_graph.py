from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from app.security import decrypt_secret
from rag_lib.config import settings
from rag_lib.database import SessionLocal
from rag_lib.embeddings import get_embedding
from rag_lib.models import ChatMessage, MessageRole, ProviderConfig
from rag_lib.providers import generate, resolve_model
from rag_lib.vector_store import search

SYSTEM_PROMPT = (
    "You are an enterprise knowledge assistant. Answer the user's question using only "
    "the provided context. Cite your sources inline using [n] markers that reference the "
    "numbered context passages. If the context does not contain the answer, say so "
    "honestly instead of guessing."
)


class RagState(TypedDict, total=False):
    user_id: str
    chat_id: str
    question: str
    history: list[dict]
    contexts: list[dict]
    answer: str
    provider: str
    model: str
    knowledge_base_ids: list[str]


def _resolve_user_provider(user_id: str, provider: str | None = None, model: str | None = None) -> tuple:
    db = SessionLocal()
    try:
        config = None
        if provider is not None and provider != "ollama":
            config = (
                db.query(ProviderConfig)
                .filter(ProviderConfig.user_id == user_id, ProviderConfig.provider == provider)
                .first()
            )
            if config is None:
                raise ValueError(f"Provider '{provider}' is not configured for this user")
        if config is None and provider is None:
            config = (
                db.query(ProviderConfig)
                .filter(ProviderConfig.user_id == user_id)
                .order_by(ProviderConfig.updated_at.desc())
                .first()
            )
    finally:
        db.close()

    if config is not None:
        return (
            config.provider,
            model or resolve_model(config.provider, config.model),
            decrypt_secret(config.api_key_encrypted) if config.api_key_encrypted else None,
            config.base_url,
        )

    return settings.default_provider, model or settings.ollama_model, None, None


def _load_memory(state: RagState) -> dict:
    db = SessionLocal()
    try:
        messages = (
            db.query(ChatMessage)
            .filter(ChatMessage.chat_id == state["chat_id"])
            .order_by(ChatMessage.created_at.desc())
            .limit(settings.memory_turns * 2)
            .all()
        )
        messages.reverse()
        history = [
            {"role": m.role.value, "content": m.content}
            for m in messages
            if m.role in (MessageRole.user, MessageRole.assistant)
        ]
    finally:
        db.close()
    return {"history": history}


def _retrieve(state: RagState) -> dict:
    embedding = get_embedding(state["question"])
    results = search(
        state["user_id"],
        embedding,
        top_k=settings.top_k,
        knowledge_base_ids=state.get("knowledge_base_ids"),
    )
    return {"contexts": results}


def _generate_answer(state: RagState) -> dict:
    provider, model, api_key, base_url = _resolve_user_provider(
        state["user_id"], state.get("provider"), state.get("model")
    )

    context = "\n".join(
        f"[{i + 1}] (from {r['filename']}): {r['text']}"
        for i, r in enumerate(state["contexts"])
    )

    messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(state.get("history", [])[-settings.memory_turns * 2 :])
    messages.append(
        {
            "role": "user",
            "content": (
                f"Context:\n{context}\n\n"
                f"Question: {state['question']}\n\n"
                "Answer the question using the context. Cite sources with [n] markers."
            ),
        }
    )

    answer = generate(provider, model, messages, api_key=api_key, base_url=base_url)
    return {"answer": answer, "provider": provider, "model": model}


def build_graph():
    graph = StateGraph(RagState)
    graph.add_node("load_memory", _load_memory)
    graph.add_node("retrieve", _retrieve)
    graph.add_node("generate", _generate_answer)
    graph.add_edge(START, "load_memory")
    graph.add_edge("load_memory", "retrieve")
    graph.add_edge("retrieve", "generate")
    graph.add_edge("generate", END)
    return graph.compile()


def run_rag(user_id: str, chat_id: str, question: str, provider=None, model=None, knowledge_base_ids=None) -> dict:
    result = build_graph().invoke(
        {
            "user_id": user_id,
            "chat_id": chat_id,
            "question": question,
            "history": [],
            "contexts": [],
            "answer": "",
            "provider": provider,
            "model": model,
            "knowledge_base_ids": knowledge_base_ids,
        }
    )
    return result