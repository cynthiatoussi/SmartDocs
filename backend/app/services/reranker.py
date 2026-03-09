# backend/app/services/reranker.py

from typing import List
from langchain_core.documents import Document

# CrossEncoder : modèle qui évalue la pertinence d'un chunk
# par rapport à une question en les lisant ENSEMBLE
# Contrairement aux embeddings qui encodent question et chunk séparément,
# le CrossEncoder les analyse en paire — bien plus précis
from sentence_transformers import CrossEncoder

from app.core.config import settings
from app.core.logger import logger


# ── Modèle de reranking ───────────────────────────────────────────────────────
# "cross-encoder/ms-marco-MiniLM-L-6-v2" :
# - Entraîné spécifiquement pour évaluer la pertinence question/passage
# - Léger (~80 Mo) et très rapide
# - Retourne un score entre -∞ et +∞ (plus c'est élevé, plus c'est pertinent)
RERANKER_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"


def get_reranker() -> CrossEncoder:
    """
    Initialise et retourne le modèle de reranking CrossEncoder.
    
    Le CrossEncoder est différent des embeddings :
    
    Embeddings (retriever) :
    Question → vecteur A
    Chunk    → vecteur B
    Score    = similarité(A, B)
    → Rapide mais approximatif
    
    CrossEncoder (reranker) :
    Input  = [Question + Chunk] ensemble
    Output = score de pertinence
    → Plus lent mais beaucoup plus précis
    
    Returns:
        CrossEncoder: modèle prêt à scorer des paires (question, chunk)
    """
    logger.info("Chargement du modèle de reranking : {}", RERANKER_MODEL)
    
    return CrossEncoder(
        # Modèle pré-entraîné sur MS MARCO — dataset de 8M de paires
        # question/passage utilisé par Microsoft pour entraîner des moteurs
        # de recherche — parfait pour notre cas d'usage
        model_name=RERANKER_MODEL,
        
        # Nombre maximum de caractères pris en compte par le modèle
        # 512 tokens ≈ 400 mots — suffisant pour évaluer un chunk
        max_length=512,
    )


def rerank(
    query: str,
    chunks: List[Document],
    top_n: int = None
) -> List[Document]:
    """
    Re-classe les chunks par pertinence réelle par rapport à la question.
    
    Processus :
    1. Forme des paires (question, chunk) pour chaque chunk
    2. Le CrossEncoder lit chaque paire et attribue un score
    3. Tri des chunks par score décroissant
    4. Retourne les top_n meilleurs
    
    Exemple concret :
    
    Hybrid Search retourne 10 chunks dans cet ordre :
    [chunk_A, chunk_B, chunk_C, chunk_D, chunk_E, ...]
    
    Après reranking (top_n=3) :
    [chunk_C, chunk_A, chunk_E]
    → chunk_C était 3ème mais est en fait le plus pertinent ✅
    
    Args:
        query: question de l'utilisateur
        chunks: liste de chunks récupérés par le Hybrid Search
        top_n: nombre de chunks à conserver après reranking
        
    Returns:
        List[Document]: top_n chunks re-classés par pertinence réelle
    """
    # Utilise top_n de la config si non spécifié
    top_n = top_n or settings.RERANKER_TOP_N
    
    # Si pas assez de chunks, on retourne ce qu'on a directement
    if not chunks:
        logger.warning("Reranker : aucun chunk à re-classer")
        return []
    
    if len(chunks) <= top_n:
        logger.info("Reranker : {} chunks — pas besoin de re-classer (top_n={})",
                    len(chunks), top_n)
        return chunks
    
    logger.info("Reranking de {} chunks → top {} (query: '{}')",
                len(chunks), top_n, query)
    
    # ── Étape 1 : Initialisation du modèle ───────────────────────
    reranker = get_reranker()
    
    # ── Étape 2 : Construction des paires (question, chunk) ───────
    # Le CrossEncoder attend une liste de paires [question, texte]
    # Il lira chaque paire ensemble pour évaluer leur pertinence
    pairs = [
        [query, chunk.page_content]
        for chunk in chunks
    ]
    
    # ── Étape 3 : Scoring des paires ─────────────────────────────
    # predict() retourne un score pour chaque paire
    # Score élevé → chunk très pertinent pour la question
    # Score bas   → chunk peu pertinent
    scores = reranker.predict(pairs)
    
    logger.info("Scores de reranking : min={:.2f}, max={:.2f}, mean={:.2f}",
                min(scores), max(scores), sum(scores) / len(scores))
    
    # ── Étape 4 : Association chunks ↔ scores ─────────────────────
    chunks_with_scores = list(zip(chunks, scores))
    
    # ── Étape 5 : Tri par score décroissant ───────────────────────
    # Le chunk avec le score le plus élevé arrive en premier
    chunks_with_scores.sort(key=lambda x: x[1], reverse=True)
    
    # ── Étape 6 : Enrichissement des métadonnées avec le score ────
    # On ajoute le score de reranking dans les métadonnées du chunk
    # Affiché dans l'interface pour montrer la confiance de chaque source
    reranked_chunks = []
    for rank, (chunk, score) in enumerate(chunks_with_scores[:top_n]):
        chunk.metadata["rerank_score"] = round(float(score), 4)
        chunk.metadata["rerank_position"] = rank + 1
        reranked_chunks.append(chunk)
    
    logger.info("Reranking terminé : {} chunks retenus", len(reranked_chunks))
    
    # Log des sources retenues pour la traçabilité
    for chunk in reranked_chunks:
        logger.debug(
            "  → [{}] score={} | source={} | page={}",
            chunk.metadata["rerank_position"],
            chunk.metadata["rerank_score"],
            chunk.metadata.get("source", "?"),
            chunk.metadata.get("page", "?"),
        )
    
    return reranked_chunks

"""
Le reranker est la pièce maîtresse qui garantit que les chunks envoyés au LLM sont vraiment pertinents pour la question posée.
Voilà comment les trois services s'enchaînent :

Question utilisateur
      ↓
hybrid_search()        → 10 chunks candidats (vectoriel + BM25)
      ↓
rerank()               → 3 chunks les plus pertinents
      ↓
llm.py                 → génère la réponse finale
"""