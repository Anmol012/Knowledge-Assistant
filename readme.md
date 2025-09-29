# RAG Chat with PDF Application

A containerized RAG (Retrieval Augmented Generation) application that allows users to upload PDF documents and chat with their content using FastAPI, LanceDB, MySQL, and Ollama.

## Features

- Upload PDF documents
- Extract and chunk text content
- Generate embeddings using SentenceTransformers
- Store vectors in LanceDB
- Chat with document content using Ollama with Gemma 2B model
- Store chat history in MySQL
- Fully containerized with Docker

## Architecture

- **FastAPI**: Web framework for API endpoints
- **LanceDB**: Vector database for storing document embeddings
- **MySQL**: Relational database for metadata and chat history
- **Ollama**: Local LLM inference with Gemma 2B model
- **SentenceTransformers**: For generating embeddings

## Setup

1. Clone the repository and navigate to the project directory

2. Build and run with Docker Compose:
```bash
docker-compose up --build
```

The first startup will take longer as it downloads the Gemma 2B model (~1.4GB).

## Available Models

You can change the model in the `.env` file:
- `gemma:2b` - Google's Gemma 2B (default, ~1.4GB)
- `phi3:mini` - Microsoft's Phi-3 Mini (~2.3GB)
- `qwen2:1.5b` - Qwen2 1.5B (~934MB)
- `tinyllama:1.1b` - TinyLlama 1.1B (~637MB)

## API Endpoints

### Upload PDF
```http
POST /upload
Content-Type: multipart/form-data
```
Upload a PDF file and get a session ID for chatting.

### Chat with PDF
```http
POST /chat
Content-Type: application/json

{
  "message": "What is this document about?",
  "session_id": "your-session-id"
}
```

### Get Chat History
```http
GET /history/{session_id}
```

### Health Check
```http
GET /health
```

## Usage Example

1. Start the application:
```bash
docker-compose up
```
Wait for the model to be downloaded and loaded.

2. Upload a PDF:
```python
import requests

with open('document.pdf', 'rb') as f:
    files = {'file': f}
    response = requests.post('http://localhost:8000/upload', files=files)
    session_id = response.json()['session_id']
```

3. Chat with the document:
```python
data = {
    "message": "What is the main topic of this document?",
    "session_id": session_id
}
response = requests.post('http://localhost:8000/chat', json=data)
print(response.json()['response'])
```

## Configuration

Environment variables:
- `OLLAMA_MODEL`: Model to use (default: gemma:2b)
- `OLLAMA_HOST`: Ollama host (default: ollama)
- `OLLAMA_PORT`: Ollama port (default: 11434)
- `MYSQL_HOST`: MySQL host (default: mysql)
- `MYSQL_PORT`: MySQL port (default: 3306)
- `MYSQL_USER`: MySQL user (default: root)
- `MYSQL_PASSWORD`: MySQL password (default: password)
- `MYSQL_DATABASE`: MySQL database (default: ragdb)
- `LANCEDB_PATH`: LanceDB storage path (default: /app/lancedb)

## Data Persistence

- MySQL data is persisted in the `mysql_data` Docker volume
- LanceDB data is persisted in the `lancedb_data` Docker volume
- Ollama models are persisted in the `ollama_data` Docker volume

## Performance Notes

- Gemma 2B model requires ~2GB RAM for inference
- First response may be slower as the model loads
- Subsequent responses are faster due to model caching

## Development

To run in development mode:

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Start Ollama separately and pull the model:
```bash
ollama serve &
ollama pull gemma:2b
```

3. Set environment variables and run:
```bash
python main.py
```

The API will be available at `http://localhost:8000` with automatic documentation at `http://localhost:8000/docs`.

## Troubleshooting

- If Ollama fails to start, ensure you have enough disk space for the model
- For ARM64 systems (Apple Silicon), Ollama will automatically use optimized versions
- Check container logs: `docker-compose logs ollama` or `docker-compose logs app`