import threading
import uuid

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PointStruct,
    VectorParams,
)

from rag_lib.config import settings

_client = None
_lock = threading.Lock()


def get_client() -> QdrantClient:
    global _client
    if _client is None:
        with _lock:
            if _client is None:
                _client = QdrantClient(host=settings.qdrant_host, port=settings.qdrant_port)
    return _client


def ensure_collection() -> None:
    client = get_client()
    if not client.collection_exists(settings.qdrant_collection):
        client.create_collection(
            collection_name=settings.qdrant_collection,
            vectors_config=VectorParams(size=settings.embedding_dim, distance=Distance.COSINE),
        )


def _point_id(user_id: str, document_id: str, chunk_index: int) -> str:
    return str(
        uuid.uuid5(
            uuid.NAMESPACE_URL,
            f"{settings.qdrant_collection}:{user_id}:{document_id}:{chunk_index}",
        )
    )


def upsert_chunks(
    user_id: str,
    knowledge_base_id: str | None,
    document_id: str,
    filename: str,
    chunks: list[str],
    embeddings: list[list[float]],
) -> None:
    ensure_collection()
    points = [
        PointStruct(
            id=_point_id(user_id, document_id, i),
            vector=embeddings[i],
            payload={
                "user_id": user_id,
                "knowledge_base_id": knowledge_base_id,
                "document_id": document_id,
                "filename": filename,
                "chunk_index": i,
                "text": chunks[i],
            },
        )
        for i in range(len(chunks))
    ]
    get_client().upsert(collection_name=settings.qdrant_collection, points=points)


def search(
    user_id: str,
    embedding: list[float],
    top_k: int = 3,
    knowledge_base_ids: list[str] | None = None,
) -> list[dict]:
    client = get_client()
    must: list = [FieldCondition(key="user_id", match=MatchValue(value=user_id))]
    if knowledge_base_ids:
        must.append(
            Filter(
                should=[
                    FieldCondition(key="knowledge_base_id", match=MatchValue(value=kb_id))
                    for kb_id in knowledge_base_ids
                ]
            )
        )
    results = client.search(
        collection_name=settings.qdrant_collection,
        query_vector=embedding,
        query_filter=Filter(must=must),
        limit=top_k,
    )
    return [
        {
            "text": hit.payload.get("text", ""),
            "filename": hit.payload.get("filename", ""),
            "document_id": hit.payload.get("document_id", ""),
            "chunk_index": hit.payload.get("chunk_index", 0),
            "score": hit.score,
        }
        for hit in results
    ]


def delete_document_vectors(user_id: str, document_id: str) -> None:
    client = get_client()
    client.delete(
        collection_name=settings.qdrant_collection,
        points_selector=Filter(
            must=[
                FieldCondition(key="user_id", match=MatchValue(value=user_id)),
                FieldCondition(key="document_id", match=MatchValue(value=document_id)),
            ]
        ),
    )


def delete_knowledge_base_vectors(user_id: str, knowledge_base_id: str) -> None:
    client = get_client()
    client.delete(
        collection_name=settings.qdrant_collection,
        points_selector=Filter(
            must=[
                FieldCondition(key="user_id", match=MatchValue(value=user_id)),
                FieldCondition(key="knowledge_base_id", match=MatchValue(value=knowledge_base_id)),
            ]
        ),
    )


def delete_user_vectors(user_id: str) -> None:
    client = get_client()
    client.delete(
        collection_name=settings.qdrant_collection,
        points_selector=Filter(must=[FieldCondition(key="user_id", match=MatchValue(value=user_id))]),
    )