from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.core.logger import logger
from app.services.retriever import hybrid_search
from app.services.reranker import rerank
from app.services.llm import generate_response

router = APIRouter()

class AskRequest(BaseModel):
    query: str
    workspace_id: str = "default"
    provider: str = "groq"
    model: Optional[str] = None

@router.post("/ask", summary="Pose une question sur les documents du workspace")
async def ask(request: AskRequest):
    """Pipeline RAG complet : Question → Hybrid Search → Reranking → LLM → Réponse"""
    logger.info("=== Nouvelle question : '{}' ===", request.query)
    chunks = hybrid_search(query=request.query, workspace_id=request.workspace_id)
    if not chunks:
        raise HTTPException(status_code=404, detail="Aucun document trouvé dans ce workspace.")
    reranked_chunks = rerank(query=request.query, chunks=chunks)
    result = generate_response(query=request.query, chunks=reranked_chunks, provider=request.provider, model=request.model)
    return {"query": request.query, "answer": result["answer"], "sources": result["sources"], "model": result["model"], "workspace_id": request.workspace_id}
