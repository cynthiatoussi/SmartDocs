from typing import List, Optional
from langchain_core.documents import Document
from langchain_community.chat_models import ChatOllama
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage

from app.core.config import settings
from app.core.logger import logger

SYSTEM_PROMPT = """Tu es SmartDocs, un assistant intelligent spécialisé dans 
l'analyse de documents d'entreprise.

Tes règles absolues :
1. Tu réponds UNIQUEMENT à partir des extraits de documents fournis
2. Si la réponse n'est pas dans les extraits, tu le dis clairement
3. Tu cites toujours ta source (nom du document et page)
4. Tu es précis, concis et professionnel
5. Tu réponds dans la même langue que la question
"""

def get_ollama_llm() -> ChatOllama:
    logger.info("Initialisation du LLM local : {}", settings.OLLAMA_MODEL)
    return ChatOllama(
        model=settings.OLLAMA_MODEL,
        base_url=settings.OLLAMA_BASE_URL,
        temperature=0.1,
        num_predict=2048,
    )

def get_groq_llm(model: str = None) -> ChatGroq:
    model = model or settings.GROQ_DEFAULT_MODEL
    logger.info("Initialisation du LLM Groq : {}", model)
    return ChatGroq(
        api_key=settings.GROQ_API_KEY,
        model_name=model,
        temperature=0.1,
        max_tokens=2048,
    )

def build_prompt(query: str, chunks: List[Document]) -> str:
    context_parts = []
    for i, chunk in enumerate(chunks, 1):
        source = chunk.metadata.get("source", "Document inconnu")
        page = chunk.metadata.get("page", "?")
        score = chunk.metadata.get("rerank_score", "?")
        context_parts.append(
            f"[Extrait {i} | Source: {source} | Page: {page} | Score: {score}]\n"
            f"{chunk.page_content}"
        )
    context = "\n\n---\n\n".join(context_parts)
    return f"""Voici les extraits de documents pertinents :

{context}

---

Question : {query}

Réponds en te basant UNIQUEMENT sur les extraits ci-dessus."""

def generate_response(
    query: str,
    chunks: List[Document],
    provider: str = "groq",
    model: Optional[str] = None,
) -> dict:
    logger.info("=== Génération de réponse (provider: {}) ===", provider)
    
    # Sélection du LLM
    if provider == "ollama":
        llm = get_ollama_llm()
    else:
        llm = get_groq_llm(model)
    
    # Construction du prompt
    user_prompt = build_prompt(query, chunks)
    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=user_prompt),
    ]
    
    # Appel au LLM
    response = llm.invoke(messages)
    answer = response.content
    
    logger.info("Réponse générée ({} caractères)", len(answer))
    
    # Extraction des sources
    sources = []
    for chunk in chunks:
        sources.append({
            "file": chunk.metadata.get("source", "?"),
            "page": chunk.metadata.get("page", "?"),
            "score": chunk.metadata.get("rerank_score", "?"),
            "excerpt": chunk.page_content[:200] + "..." if len(chunk.page_content) > 200 else chunk.page_content,
        })
    
    return {
        "answer": answer,
        "sources": sources,
        "model": {
            "provider": provider,
            "name": model or (settings.OLLAMA_MODEL if provider == "ollama" else settings.GROQ_DEFAULT_MODEL),
        },
    }
