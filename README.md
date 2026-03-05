# 🧠 SmartDocs — Assistant RAG sur documents internes

> Posez des questions à vos documents d'entreprise.
> SmartDocs retrouve les bonnes réponses en citant ses sources.

## 💼 Problématique métier
Les équipes passent en moyenne **2h/jour** à chercher dans leurs documents internes.
SmartDocs réduit ce temps à **quelques secondes** grâce au RAG.

## 🏗️ Architecture
```
PDF → Chunking sémantique → Embeddings → ChromaDB
Question → Hybrid Search (BM25 + Vectoriel) → Reranking → LLM → Réponse + Sources
```

## ⚙️ Stack technique
| Couche | Technologie |
|---|---|
| Frontend | Next.js 14 · TypeScript · Tailwind CSS |
| Backend | FastAPI · Python 3.11 |
| RAG | LangChain · ChromaDB · BM25 |
| Reranking | sentence-transformers (cross-encoder) |
| LLM Local | Mistral 7B via Ollama |
| LLM Cloud | LLaMA 3 / Mixtral / Gemma via Groq |
| Évaluation | RAGAS |
| Temps réel | WebSocket |
| Conteneurisation | Docker · docker-compose |

## 🚀 Lancer le projet

### Prérequis
- Python 3.11+
- Node.js 18+
- [Ollama](https://ollama.com) installé + `ollama pull mistral`
- Clé API [Groq](https://console.groq.com) (gratuite)

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Interface → `http://localhost:3000`
Doc API → `http://localhost:8000/docs`