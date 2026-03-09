# backend/app/services/retriever.py

from typing import List, Tuple
from langchain_core.documents import Document

# BM25Retriever : algorithme de recherche par mots-clés
# BM25 (Best Match 25) est l'algorithme utilisé par les moteurs de recherche
# comme Elasticsearch — il trouve les documents qui contiennent
# exactement les mots de la requête, en tenant compte de leur fréquence
from langchain_community.retrievers import BM25Retriever

# Chroma : interface LangChain pour ChromaDB
from langchain_chroma import Chroma

from app.core.config import settings
from app.core.logger import logger
from app.services.ingestion import get_vectorstore, get_embeddings_model


def get_all_chunks(workspace_id: str) -> List[Document]:
    """
    Récupère tous les chunks stockés dans ChromaDB pour un workspace.
    
    Nécessaire pour initialiser le BM25Retriever qui a besoin
    de tous les documents pour calculer ses statistiques de fréquence.
    
    Args:
        workspace_id: identifiant de l'espace de travail
        
    Returns:
        List[Document]: tous les chunks du workspace
    """
    # Accède directement à la collection ChromaDB
    vectorstore = get_vectorstore(workspace_id)
    
    # Récupère tous les documents stockés dans la collection
    # without any filter — on veut vraiment tout récupérer pour BM25
    results = vectorstore.get()
    
    # Reconstruit les objets Document LangChain depuis les données brutes
    # ChromaDB stocke séparément les textes et les métadonnées
    documents = [
        Document(
            page_content=text,
            metadata=meta
        )
        for text, meta in zip(
            results["documents"],  # textes des chunks
            results["metadatas"]   # métadonnées associées
        )
    ]
    
    logger.info("Workspace {} : {} chunks récupérés pour BM25",
                workspace_id, len(documents))
    
    return documents


def vector_search(
    query: str,
    workspace_id: str,
    top_k: int = None
) -> List[Tuple[Document, float]]:
    """
    Recherche vectorielle dans ChromaDB.
    
    Transforme la question en embedding et trouve les chunks
    dont le vecteur est le plus proche mathématiquement.
    Efficace pour trouver des passages sémantiquement similaires
    même si les mots exacts sont différents.
    
    Exemple :
    Question : "Quelle est la durée des vacances ?"
    Trouve    : "Les congés payés sont de 5 semaines par an"
    → Les mots sont différents mais le sens est proche ✅
    
    Args:
        query: question de l'utilisateur
        workspace_id: espace de travail cible
        top_k: nombre de résultats à retourner
        
    Returns:
        List[Tuple[Document, float]]: chunks avec leur score de similarité
    """
    # Utilise top_k de la config si non spécifié
    top_k = top_k or settings.RETRIEVER_TOP_K
    
    logger.info("Recherche vectorielle : '{}'", query)
    
    vectorstore = get_vectorstore(workspace_id)
    
    # similarity_search_with_score retourne les chunks ET leur score
    # Score entre 0 et 1 — plus il est proche de 0, plus c'est pertinent
    # (ChromaDB utilise la distance cosinus)
    results = vectorstore.similarity_search_with_score(
        query=query,
        k=top_k,
    )
    
    logger.info("Recherche vectorielle : {} résultats trouvés", len(results))
    
    return results


def bm25_search(
    query: str,
    workspace_id: str,
    top_k: int = None
) -> List[Document]:
    """
    Recherche BM25 (par mots-clés) dans tous les chunks du workspace.
    
    BM25 est excellent pour trouver des termes précis :
    - Noms propres ("Jean Dupont", "Article L1234-5")
    - Numéros ("référence 42-B", "section 3.2.1")
    - Termes techniques exacts ("RGPD", "CSRD", "KPI")
    
    Là où la recherche vectorielle cherche le sens,
    BM25 cherche les mots exacts — les deux sont complémentaires.
    
    Args:
        query: question de l'utilisateur
        workspace_id: espace de travail cible
        top_k: nombre de résultats à retourner
        
    Returns:
        List[Document]: chunks les plus pertinents selon BM25
    """
    top_k = top_k or settings.RETRIEVER_TOP_K
    
    logger.info("Recherche BM25 : '{}'", query)
    
    # Récupère tous les chunks pour initialiser BM25
    all_chunks = get_all_chunks(workspace_id)
    
    if not all_chunks:
        logger.warning("Aucun chunk trouvé dans le workspace {}", workspace_id)
        return []
    
    # Initialise le retriever BM25 avec tous les chunks du workspace
    # BM25 calcule des statistiques sur la fréquence des mots
    # dans tous les documents pour pondérer les résultats
    bm25_retriever = BM25Retriever.from_documents(
        documents=all_chunks,
        # Nombre de résultats à retourner
        k=top_k,
    )
    
    results = bm25_retriever.invoke(query)
    
    logger.info("Recherche BM25 : {} résultats trouvés", len(results))
    
    return results


def hybrid_search(
    query: str,
    workspace_id: str,
    top_k: int = None
) -> List[Document]:
    """
    Hybrid Search : combine la recherche vectorielle et BM25.
    
    Stratégie de fusion :
    1. Lance les deux recherches en parallèle
    2. Fusionne les résultats en éliminant les doublons
    3. Pondère : vectoriel à 60%, BM25 à 40%
       (le sens est légèrement plus important que les mots exacts)
    4. Retourne les top_k meilleurs résultats combinés
    
    Cette approche est bien plus robuste qu'une recherche seule :
    - Un chunk trouvé par les deux méthodes remonte en priorité ✅
    - Les cas limites de chaque méthode sont couverts par l'autre ✅
    
    Args:
        query: question de l'utilisateur
        workspace_id: espace de travail cible
        top_k: nombre de résultats à retourner
        
    Returns:
        List[Document]: meilleurs chunks fusionnés et triés
    """
    top_k = top_k or settings.RETRIEVER_TOP_K
    
    logger.info("=== Hybrid Search : '{}' (workspace: {}) ===",
                query, workspace_id)
    
    # ── Étape 1 : Les deux recherches ────────────────────────────
    vector_results = vector_search(query, workspace_id, top_k)
    bm25_results = bm25_search(query, workspace_id, top_k)
    
    # ── Étape 2 : Fusion avec déduplication ──────────────────────
    # Dictionnaire pour tracker les chunks déjà vus
    # Clé : contenu du chunk (évite les doublons)
    # Valeur : (Document, score combiné)
    seen_chunks = {}
    
    # Traitement des résultats vectoriels (poids : 0.6)
    for rank, (doc, distance) in enumerate(vector_results):
        # Convertit la distance en score de pertinence
        # Distance proche de 0 → score proche de 1 (très pertinent)
        score = (1 - distance) * 0.6
        
        chunk_key = doc.page_content[:100]  # clé unique basée sur le début du texte
        
        if chunk_key not in seen_chunks:
            seen_chunks[chunk_key] = (doc, score)
        else:
            # Si déjà vu par BM25 : additionne les scores
            existing_doc, existing_score = seen_chunks[chunk_key]
            seen_chunks[chunk_key] = (existing_doc, existing_score + score)
    
    # Traitement des résultats BM25 (poids : 0.4)
    for rank, doc in enumerate(bm25_results):
        # BM25 ne donne pas de score — on calcule un score basé sur le rang
        # Premier résultat → score maximal, dernier → score minimal
        score = (1 - rank / len(bm25_results)) * 0.4
        
        chunk_key = doc.page_content[:100]
        
        if chunk_key not in seen_chunks:
            seen_chunks[chunk_key] = (doc, score)
        else:
            existing_doc, existing_score = seen_chunks[chunk_key]
            seen_chunks[chunk_key] = (existing_doc, existing_score + score)
    
    # ── Étape 3 : Tri par score combiné décroissant ───────────────
    # Les chunks trouvés par les deux méthodes ont un score > 1
    # et remontent naturellement en tête de liste
    sorted_chunks = sorted(
        seen_chunks.values(),
        key=lambda x: x[1],  # tri par score
        reverse=True          # ordre décroissant (meilleur score en premier)
    )
    
    # ── Étape 4 : Retourne les top_k meilleurs chunks ─────────────
    final_results = [doc for doc, score in sorted_chunks[:top_k]]
    
    logger.info("Hybrid Search terminé : {} chunks retenus", len(final_results))
    
    return final_results