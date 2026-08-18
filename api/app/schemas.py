from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from rag_lib.models import DocumentStatus, MessageRole, UserRole


class RegisterRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    full_name: str
    role: UserRole
    is_active: bool
    created_at: datetime


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    filename: str
    file_type: str
    status: DocumentStatus
    chunk_count: int
    knowledge_base_id: Optional[str] = None
    error: Optional[str] = None
    created_at: datetime


class UploadResponse(BaseModel):
    document_id: str
    filename: str
    status: DocumentStatus
    knowledge_base_id: Optional[str] = None
    message: str = "Document queued for ingestion"


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)
    chat_id: Optional[str] = None
    provider: Optional[str] = None
    model: Optional[str] = None
    knowledge_base_ids: Optional[list[str]] = None


class SourceRef(BaseModel):
    filename: str
    chunk_index: int
    snippet: str


class ChatResponse(BaseModel):
    chat_id: str
    answer: str
    sources: list[SourceRef] = []
    provider: Optional[str] = None
    model: Optional[str] = None
    knowledge_base_ids: list[str] = []


class ChatOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    provider: Optional[str] = None
    model: Optional[str] = None
    knowledge_base_ids: Optional[list] = None
    created_at: datetime


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    role: MessageRole
    content: str
    sources: Optional[list] = None
    created_at: datetime


class KnowledgeBaseIn(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=2000)


class KnowledgeBaseUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=2000)


class KnowledgeBaseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: Optional[str] = None
    document_count: int = 0
    created_at: datetime


class ProviderConfigIn(BaseModel):
    provider: str = Field(min_length=1, max_length=32)
    api_key: Optional[str] = Field(default=None, max_length=512)
    model: Optional[str] = Field(default=None, max_length=128)
    base_url: Optional[str] = Field(default=None, max_length=512)


class ProviderConfigOut(BaseModel):
    provider: str
    model: str
    api_key_masked: str
    base_url: Optional[str] = None
    updated_at: datetime


class AdminRoleUpdate(BaseModel):
    role: UserRole