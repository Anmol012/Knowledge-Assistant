#!/bin/bash

echo "Setting up Ollama models..."

docker-compose up -d ollama

sleep 30

echo "Pulling Gemma 2B model..."
docker exec rag_ollama ollama pull gemma:2b

echo "Pulling additional small models..."
docker exec rag_ollama ollama pull phi3:mini
docker exec rag_ollama ollama pull tinyllama:1.1b

echo "Available models:"
docker exec rag_ollama ollama list

echo "Models setup complete!"