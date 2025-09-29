import requests
import json

BASE_URL = "http://localhost:8000"

def upload_pdf(file_path):
    with open(file_path, 'rb') as f:
        files = {'file': f}
        response = requests.post(f"{BASE_URL}/upload", files=files)
    return response.json()

def chat_with_pdf(session_id, message):
    data = {
        "message": message,
        "session_id": session_id
    }
    response = requests.post(f"{BASE_URL}/chat", json=data)
    return response.json()

def get_chat_history(session_id):
    response = requests.get(f"{BASE_URL}/history/{session_id}")
    return response.json()

if __name__ == "__main__":
    pdf_path = "sample.pdf"
    
    print("Uploading PDF...")
    upload_result = upload_pdf(pdf_path)
    session_id = upload_result["session_id"]
    print(f"Session ID: {session_id}")
    
    while True:
        question = input("\nAsk a question (or 'quit' to exit): ")
        if question.lower() == 'quit':
            break
            
        response = chat_with_pdf(session_id, question)
        print(f"Answer: {response['response']}")
    
    print("\nChat History:")
    history = get_chat_history(session_id)
    for entry in history:
        print(f"Q: {entry['message']}")
        print(f"A: {entry['response']}")
        print("---")