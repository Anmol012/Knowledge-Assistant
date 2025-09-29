# RAG Chat with PDF Application

A containerized RAG (Retrieval Augmented Generation) application that allows users to upload PDF documents and chat with their content using FastAPI, LanceDB, and MySQL.

## Features

- Upload PDF documents
- Extract and chunk text content
- Generate embeddings using SentenceTransformers
- Store vectors in LanceDB
- Chat with document content using OpenAI GPT
- Store chat history in MySQL
- Fully containerized with Docker

## Architecture

- **FastAPI**: Web framework for API endpoints
- **LanceDB**: Vector database for storing document embeddings
- **MySQL**: Relational database for metadata and chat history
- **SentenceTransformers**: For generating embeddings
- **OpenAI GPT**: For generating responses

## Setup

1. Clone the repository and navigate to the project directory

2. Create a `.env` file with your OpenAI API key:
```
OPENAI_API_KEY=your-openai-api-key-here
```

3. Build and run with Docker Compose:
```bash
docker-compose up --build
```

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
- `OPENAI_API_KEY`: Your OpenAI API key
- `MYSQL_HOST`: MySQL host (default: mysql)
- `MYSQL_PORT`: MySQL port (default: 3306)
- `MYSQL_USER`: MySQL user (default: root)
- `MYSQL_PASSWORD`: MySQL password (default: password)
- `MYSQL_DATABASE`: MySQL database (default: ragdb)
- `LANCEDB_PATH`: LanceDB storage path (default: /app/lancedb)

## Data Persistence

- MySQL data is persisted in the `mysql_data` Docker volume
- LanceDB data is persisted in the `lancedb_data` Docker volume

## Development

To run in development mode:

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Set environment variables and run:
```bash
python main.py
```

The API will be available at `http://localhost:8000` with automatic documentation at `http://localhost:8000/docs`.