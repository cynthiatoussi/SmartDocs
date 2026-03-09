# backend/app/services/ingestion.py

import os
import uuid
from pathlib import Path
from typing import List

# PyPDFLoader : charge et extrait le texte d'un fichier PDF page par page
from langchain_community.document_loaders import PyPDFLoader

# RecursiveCharacterTextSplitter : découpe le texte en chunks intelligemment
# "Recursive" car il essaie d'abord de couper aux paragraphes, puis aux
# phrases, puis aux mots — pour garder un maximum de cohérence sémantique
from langchain_text_splitters import RecursiveCharacterTextSplitter

# Document : objet LangChain qui contient le texte + les métadonnées
from langchain_core.documents import Document

# Chroma : interface LangChain pour interagir avec ChromaDB
from langchain_chroma import Chroma

# HuggingFaceEmbeddings : génère les embeddings localement
# On utilise "all-MiniLM-L6-v2" — modèle léger (~80 Mo) et très performant
# Il transforme chaque chunk en vecteur de 384 dimensions
from langchain_community.embeddings import HuggingFaceEmbeddings

from app.core.config import settings
from app.core.logger import logger


def get_embeddings_model() -> HuggingFaceEmbeddings:
    """
    Initialise et retourne le modèle d'embeddings.
    
    On utilise HuggingFace plutôt qu'OpenAI pour les embeddings car :
    - 100% gratuit et local — pas de coût par token
    - all-MiniLM-L6-v2 est léger (~80 Mo) et très rapide
    - Qualité suffisante pour la recherche de documents
    
    Returns:
        HuggingFaceEmbeddings: modèle prêt à générer des embeddings
    """
    logger.info("Chargement du modèle d'embeddings : all-MiniLM-L6-v2")
    
    return HuggingFaceEmbeddings(
        # Modèle léger et performant pour la recherche sémantique
        # Téléchargé automatiquement depuis HuggingFace au premier lancement
        model_name="all-MiniLM-L6-v2",
        
        # Paramètres du modèle
        model_kwargs={
            # "cpu" : tourne sur le processeur — pas besoin de GPU
            "device": "cpu"
        },
        
        encode_kwargs={
            # Normalise les vecteurs — améliore la précision de la recherche
            "normalize_embeddings": True
        }
    )


def get_vectorstore(workspace_id: str) -> Chroma:
    """
    Retourne la base vectorielle ChromaDB pour un espace de travail donné.
    
    Chaque workspace a sa propre collection ChromaDB isolée.
    Cela permet d'avoir des documents séparés par département
    (ex: RH, Juridique, Produit) sans qu'ils se mélangent.
    
    Args:
        workspace_id: identifiant unique de l'espace de travail
        
    Returns:
        Chroma: instance de la base vectorielle prête à l'emploi
    """
    return Chroma(
        # Nom de la collection — une par workspace
        # ChromaDB isole les données entre collections
        collection_name=f"smartdocs_{workspace_id}",
        
        # Modèle utilisé pour générer les embeddings
        # Doit être le même à l'ingestion ET à la recherche
        embedding_function=get_embeddings_model(),
        
        # Dossier de persistance sur le disque
        # Les données survivent aux redémarrages du serveur
        persist_directory=settings.CHROMA_PERSIST_DIR,
    )


def load_pdf(file_path: str) -> List[Document]:
    """
    Charge un fichier PDF et extrait son contenu page par page.
    
    Args:
        file_path: chemin absolu vers le fichier PDF
        
    Returns:
        List[Document]: liste de Documents LangChain, un par page
        
    Raises:
        FileNotFoundError: si le fichier PDF n'existe pas
        ValueError: si le fichier n'est pas un PDF valide
    """
    # Vérification que le fichier existe avant de tenter de le lire
    if not Path(file_path).exists():
        raise FileNotFoundError(f"Fichier introuvable : {file_path}")
    
    # Vérification de l'extension
    if not file_path.endswith(".pdf"):
        raise ValueError(f"Le fichier doit être un PDF : {file_path}")
    
    logger.info("Chargement du PDF : {}", file_path)
    
    # PyPDFLoader charge le PDF et crée un Document par page
    # Chaque Document contient :
    # - page_content : le texte de la page
    # - metadata : {"source": "chemin/fichier.pdf", "page": 0}
    loader = PyPDFLoader(file_path)
    documents = loader.load()
    
    logger.info("PDF chargé : {} pages extraites", len(documents))
    
    return documents


def split_documents(documents: List[Document]) -> List[Document]:
    """
    Découpe les documents en chunks optimisés pour le RAG.
    
    RecursiveCharacterTextSplitter découpe dans cet ordre de priorité :
    1. Aux doubles sauts de ligne (entre paragraphes)
    2. Aux sauts de ligne simples
    3. Aux points (fin de phrase)
    4. Aux espaces (entre mots)
    5. Caractère par caractère en dernier recours
    
    Ce découpage intelligent préserve au maximum la cohérence du texte.
    
    Args:
        documents: liste de Documents LangChain (pages du PDF)
        
    Returns:
        List[Document]: liste de chunks prêts pour les embeddings
    """
    logger.info("Découpage en chunks (taille={}, overlap={})",
                settings.CHUNK_SIZE, settings.CHUNK_OVERLAP)
    
    splitter = RecursiveCharacterTextSplitter(
        # Taille maximale d'un chunk en caractères
        # 1000 caractères ≈ 200 mots — bon équilibre contexte/précision
        chunk_size=settings.CHUNK_SIZE,
        
        # Chevauchement entre chunks consécutifs
        # Exemple avec overlap=200 :
        # Chunk 1 : caractères 0-1000
        # Chunk 2 : caractères 800-1800  ← reprend les 200 derniers de chunk 1
        # Évite de couper une idée en deux entre deux chunks
        chunk_overlap=settings.CHUNK_OVERLAP,
        
        # Mesure la taille en nombre de caractères (et non en tokens)
        length_function=len,
        
        # Séparateurs essayés dans l'ordre pour couper le texte
        separators=["\n\n", "\n", ".", " ", ""]
    )
    
    chunks = splitter.split_documents(documents)
    
    logger.info("Découpage terminé : {} chunks générés", len(chunks))
    
    return chunks


def enrich_metadata(
    chunks: List[Document],
    file_name: str,
    workspace_id: str
) -> List[Document]:
    """
    Enrichit les métadonnées de chaque chunk avec des informations utiles.
    
    Les métadonnées sont stockées avec chaque chunk dans ChromaDB.
    Elles permettent d'afficher les sources précises dans l'interface
    (nom du fichier, numéro de page, workspace...).
    
    Args:
        chunks: liste de chunks à enrichir
        file_name: nom du fichier PDF source
        workspace_id: identifiant de l'espace de travail
        
    Returns:
        List[Document]: chunks avec métadonnées enrichies
    """
    for i, chunk in enumerate(chunks):
        chunk.metadata.update({
            # Nom du fichier source — affiché dans les sources côté frontend
            "source": file_name,
            
            # Identifiant unique du chunk — utile pour le débogage
            "chunk_id": str(uuid.uuid4()),
            
            # Index du chunk dans le document — pour trier par ordre d'apparition
            "chunk_index": i,
            
            # Workspace auquel appartient ce chunk
            "workspace_id": workspace_id,
            
            # Nombre de caractères du chunk — utile pour les métriques
            "chunk_size": len(chunk.page_content),
        })
    
    return chunks


def ingest_document(
    file_path: str,
    file_name: str,
    workspace_id: str
) -> dict:
    """
    Pipeline complet d'ingestion d'un document PDF.
    
    Orchestre toutes les étapes :
    1. Chargement du PDF
    2. Découpage en chunks
    3. Enrichissement des métadonnées
    4. Génération des embeddings + stockage dans ChromaDB
    
    Args:
        file_path: chemin absolu vers le fichier PDF
        file_name: nom original du fichier (affiché dans les sources)
        workspace_id: espace de travail cible
        
    Returns:
        dict: résumé de l'ingestion (chunks créés, pages traitées...)
    """
    logger.info("=== Début ingestion : {} (workspace: {}) ===",
                file_name, workspace_id)
    
    # ── Étape 1 : Chargement du PDF ───────────────────────────────
    documents = load_pdf(file_path)
    
    # ── Étape 2 : Découpage en chunks ─────────────────────────────
    chunks = split_documents(documents)
    
    # ── Étape 3 : Enrichissement des métadonnées ──────────────────
    chunks = enrich_metadata(chunks, file_name, workspace_id)
    
    # ── Étape 4 : Génération des embeddings + stockage ChromaDB ───
    logger.info("Génération des embeddings et stockage dans ChromaDB...")
    
    # get_vectorstore retourne la collection ChromaDB du workspace
    vectorstore = get_vectorstore(workspace_id)
    
    # add_documents :
    # 1. Génère l'embedding de chaque chunk via all-MiniLM-L6-v2
    # 2. Stocke le vecteur + le texte + les métadonnées dans ChromaDB
    vectorstore.add_documents(chunks)
    
    logger.info("=== Ingestion terminée : {} chunks stockés ===", len(chunks))
    
    # Retourne un résumé de l'ingestion
    return {
        "status": "success",
        "file_name": file_name,
        "workspace_id": workspace_id,
        "pages_processed": len(documents),
        "chunks_created": len(chunks),
    }