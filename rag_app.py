from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import uuid
from typing import List
import pymysql
import lancedb
import PyPDF2
from sentence_transformers import SentenceTransformer
import httpx
from datetime import datetime
import numpy as np
from io import BytesIO

app = FastAPI(title="RAG Chat with PDF")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str
    session_id: str

class ChatResponse(BaseModel):
    response: str
    session_id: str

MYSQL_CONFIG = {
    'host': os.getenv('MYSQL_HOST', 'mysql'),
    'port': int(os.getenv('MYSQL_PORT', 3306)),
    'user': os.getenv('MYSQL_USER', 'root'),
    'password': os.getenv('MYSQL_PASSWORD', 'password'),
    'database': os.getenv('MYSQL_DATABASE', 'ragdb'),
    'charset': 'utf8mb4'
}

LANCEDB_PATH = os.getenv('LANCEDB_PATH', '/app/lancedb')
OLLAMA_HOST = os.getenv('OLLAMA_HOST', 'ollama')
OLLAMA_PORT = os.getenv('OLLAMA_PORT', '11434')
OLLAMA_MODEL = os.getenv('OLLAMA_MODEL', 'gemma:2b')

model = SentenceTransformer('all-MiniLM-L6-v2')

def get_mysql_connection():
    return pymysql.connect(**MYSQL_CONFIG)

def init_mysql():
    conn = get_mysql_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            id VARCHAR(36) PRIMARY KEY,
            filename VARCHAR(255) NOT NULL,
            upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            session_id VARCHAR(36) NOT NULL
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_history (
            id INT AUTO_INCREMENT PRIMARY KEY,
            session_id VARCHAR(36) NOT NULL,
            message TEXT NOT NULL,
            response TEXT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

def get_lancedb():
    return lancedb.connect(LANCEDB_PATH)

def extract_text_from_pdf(pdf_file):
    pdf_reader = PyPDF2.PdfReader(pdf_file)
    text = ""
    for page in pdf_reader.pages:
        text += page.extract_text()
    return text

def chunk_text(text, chunk_size=1000, overlap=200):
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start = end - overlap
    return chunks

def get_embedding(text):
    return model.encode(text).tolist()

async def generate_response(prompt):
    ollama_url = f"http://{OLLAMA_HOST}:{OLLAMA_PORT}/api/generate"
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.7,
            "max_tokens": 500
        }
    }
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(ollama_url, json=payload)
            if response.status_code == 200:
                result = response.json()
                return result.get("response", "Sorry, I couldn't generate a response.")
            else:
                return f"Error from Ollama: {response.status_code}"
    except Exception as e:
        return f"Failed to connect to Ollama: {str(e)}"

@app.on_event("startup")
async def startup_event():
    init_mysql()

@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    session_id = str(uuid.uuid4())
    doc_id = str(uuid.uuid4())
    
    contents = await file.read()
    pdf_file = BytesIO(contents)
    text = extract_text_from_pdf(pdf_file)
    
    chunks = chunk_text(text)
    
    db = get_lancedb()
    
    try:
        table = db.open_table("documents")
    except:
        embeddings = [get_embedding(chunk) for chunk in chunks[:1]]
        data = [{
            "id": f"{doc_id}_0",
            "text": chunks[0],
            "embedding": embeddings[0],
            "document_id": doc_id,
            "session_id": session_id
        }]
        table = db.create_table("documents", data=data)
    
    data_to_insert = []
    for i, chunk in enumerate(chunks):
        embedding = get_embedding(chunk)
        data_to_insert.append({
            "id": f"{doc_id}_{i}",
            "text": chunk,
            "embedding": embedding,
            "document_id": doc_id,
            "session_id": session_id
        })
    
    if data_to_insert:
        table.add(data_to_insert)
    
    conn = get_mysql_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO documents (id, filename, session_id) VALUES (%s, %s, %s)",
        (doc_id, file.filename, session_id)
    )
    conn.commit()
    conn.close()
    
    return {"session_id": session_id, "document_id": doc_id, "message": "PDF uploaded successfully"}

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    query_embedding = get_embedding(request.message)
    
    db = get_lancedb()
    try:
        table = db.open_table("documents")
    except:
        raise HTTPException(status_code=400, detail="No documents uploaded")
    
    results = table.search(query_embedding).where(f"session_id = '{request.session_id}'").limit(3).to_list()
    
    if not results:
        raise HTTPException(status_code=400, detail="No relevant documents found for this session")
    
    context = "\n".join([result["text"] for result in results])
    
    prompt = f"""Based on the following context from a document, please answer the user's question accurately and concisely.

Context:
{context}

Question: {request.message}

Answer:"""
    
    answer = await generate_response(prompt)
    
    conn = get_mysql_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO chat_history (session_id, message, response) VALUES (%s, %s, %s)",
        (request.session_id, request.message, answer)
    )
    conn.commit()
    conn.close()
    
    return ChatResponse(response=answer, session_id=request.session_id)

@app.get("/history/{session_id}")
async def get_chat_history(session_id: str):
    conn = get_mysql_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT message, response, timestamp FROM chat_history WHERE session_id = %s ORDER BY timestamp",
        (session_id,)
    )
    history = cursor.fetchall()
    conn.close()
    
    return [{"message": h[0], "response": h[1], "timestamp": h[2]} for h in history]

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)