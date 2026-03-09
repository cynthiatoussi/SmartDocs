# backend/app/core/config.py

# pydantic-settings : extension de Pydantic pour gérer les configurations
# Elle lit automatiquement les variables du fichier .env
from pydantic_settings import BaseSettings

# Optional : indique qu'une variable peut être None si non définie
from typing import Optional


class Settings(BaseSettings):
    """
    Classe de configuration globale de SmartDocs.
    Toutes les variables d'environnement du .env sont chargées ici.
    Pydantic valide automatiquement les types au démarrage de l'app.
    """

    # ── LLM Local : Ollama ────────────────────────────────────────
    # Nom du modèle Ollama téléchargé localement
    OLLAMA_MODEL: str = "mistral"

    # URL du serveur Ollama — tourne en arrière-plan sur ce port
    OLLAMA_BASE_URL: str = "http://localhost:11434"

    # ── LLM Cloud : Groq ──────────────────────────────────────────
    # Clé API Groq — obligatoire, pas de valeur par défaut
    GROQ_API_KEY: str

    # Modèle Groq utilisé par défaut
    GROQ_DEFAULT_MODEL: str = "llama3-8b-8192"

    # ── Base vectorielle : ChromaDB ───────────────────────────────
    # Chemin de persistance de la base ChromaDB sur le disque
    CHROMA_PERSIST_DIR: str = "./vectorstore"

    # ── Chunking ──────────────────────────────────────────────────
    # Taille de chaque chunk en nombre de caractères
    # 1000 caractères ≈ 200 mots — bon compromis contexte/précision
    CHUNK_SIZE: int = 1000

    # Chevauchement entre deux chunks consécutifs
    # Évite de perdre le contexte aux jonctions entre chunks
    CHUNK_OVERLAP: int = 200

    # Nombre de chunks récupérés par la recherche avant le reranking
    # On en prend 10 pour que le reranker ait assez de candidats
    RETRIEVER_TOP_K: int = 10

    # Nombre de chunks conservés APRÈS le reranking pour le LLM
    # On garde les 3 meilleurs — assez de contexte sans surcharger le LLM
    RERANKER_TOP_N: int = 3

    # ── API ───────────────────────────────────────────────────────
    # URL du frontend autorisée par CORS
    FRONTEND_URL: str = "http://localhost:3000"

    # Port du serveur FastAPI
    API_PORT: int = 8000

    # ── Logs ──────────────────────────────────────────────────────
    # Niveau de verbosité : DEBUG | INFO | WARNING | ERROR
    LOG_LEVEL: str = "INFO"

    class Config:
        """
        Configuration de Pydantic pour la lecture du .env.
        env_file indique où se trouve le fichier de variables d'environnement.
        """
        # Chemin vers le fichier .env
        env_file = ".env"

        # Ignore les variables d'env inconnues au lieu de lever une erreur
        extra = "ignore"


# Instance unique de Settings utilisée dans tout le projet
# On importe "settings" directement depuis les autres fichiers
# Exemple : from app.core.config import settings
settings = Settings()