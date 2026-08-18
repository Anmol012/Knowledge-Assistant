import requests

BASE_URL = "http://localhost:8000"
API_PREFIX = "/api/v1"


def register(email, password, full_name):
    data = {"email": email, "password": password, "full_name": full_name}
    resp = requests.post(f"{BASE_URL}{API_PREFIX}/auth/register", json=data)
    resp.raise_for_status()
    return resp.json()


def login(email, password):
    data = {"email": email, "password": password}
    resp = requests.post(f"{BASE_URL}{API_PREFIX}/auth/login", json=data)
    resp.raise_for_status()
    return resp.json()


def upload_document(token, file_path):
    headers = {"Authorization": f"Bearer {token}"}
    with open(file_path, "rb") as f:
        resp = requests.post(
            f"{BASE_URL}{API_PREFIX}/documents/upload",
            headers=headers,
            files={"file": f},
        )
    resp.raise_for_status()
    return resp.json()


def get_document_status(token, document_id):
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.get(f"{BASE_URL}{API_PREFIX}/documents/{document_id}", headers=headers)
    resp.raise_for_status()
    return resp.json()


def chat(token, message, chat_id=None):
    headers = {"Authorization": f"Bearer {token}"}
    data = {"message": message}
    if chat_id:
        data["chat_id"] = chat_id
    resp = requests.post(f"{BASE_URL}{API_PREFIX}/chat", headers=headers, json=data)
    resp.raise_for_status()
    return resp.json()


def chat_history(token, chat_id):
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.get(f"{BASE_URL}{API_PREFIX}/chat/{chat_id}/messages", headers=headers)
    resp.raise_for_status()
    return resp.json()


def configure_provider(token, provider, api_key, model=None):
    headers = {"Authorization": f"Bearer {token}"}
    data = {"provider": provider, "api_key": api_key}
    if model:
        data["model"] = model
    resp = requests.put(f"{BASE_URL}{API_PREFIX}/providers", headers=headers, json=data)
    resp.raise_for_status()
    return resp.json()


if __name__ == "__main__":
    import time

    email = "demo@example.com"
    password = "demo-password-123"

    print("Registering/Logging in...")
    try:
        tokens = register(email, password, "Demo User")
    except requests.HTTPError:
        tokens = login(email, password)
    access_token = tokens["access_token"]
    print("Authenticated.")

    pdf_path = "sample.pdf"
    print(f"Uploading {pdf_path}...")
    upload = upload_document(access_token, pdf_path)
    document_id = upload["document_id"]
    print(f"Document ID: {document_id} (status: {upload['status']})")

    print("Waiting for ingestion...")
    for _ in range(30):
        doc = get_document_status(access_token, document_id)
        if doc["status"] in ("ready", "failed"):
            break
        time.sleep(2)
    print(f"Ingestion status: {doc['status']} ({doc['chunk_count']} chunks)")

    if doc["status"] == "failed":
        print(f"Ingestion failed: {doc['error']}")
        exit(1)

    chat_id = None
    while True:
        question = input("\nAsk a question (or 'quit' to exit): ")
        if question.lower() == "quit":
            break
        result = chat(access_token, question, chat_id)
        chat_id = result["chat_id"]
        print(f"Answer: {result['answer']}")
        if result["sources"]:
            print("Sources:")
            for s in result["sources"]:
                print(f"  - {s['filename']} (chunk {s['chunk_index']}): {s['snippet'][:80]}...")

    print("\nChat History:")
    for entry in chat_history(access_token, chat_id):
        print(f"{entry['role'].upper()}: {entry['content'][:200]}")