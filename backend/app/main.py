# backend/app/main.py

# FastAPI : framework principal pour créer l'API REST
from fastapi import FastAPI

# CORSMiddleware : middleware qui gère les permissions cross-origin
# Indispensable pour que le frontend Next.js (port 3000) puisse
# communiquer avec le backend FastAPI (port 8000)
from fastapi.middleware.cors import CORSMiddleware

# WebSocket : pour la communication temps réel
# Utilisé pour envoyer le statut d'ingestion en direct au frontend
from fastapi import WebSocket

# On importe les routers de chaque module
# Chaque router gère un groupe d'endpoints liés à une fonctionnalité
from app.routes.upload import router as upload_router
from app.routes.ask import router as ask_router
from app.routes.workspaces import router as workspaces_router
from app.routes.evaluation import router as evaluation_router

# Configuration globale et logger
from app.core.config import settings
from app.core.logger import logger, setup_logger


# ── Initialisation du logger ──────────────────────────────────────────────────
# À appeler avant tout — pour logger les événements du démarrage
setup_logger()


# ── Création de l'application FastAPI ────────────────────────────────────────
app = FastAPI(
    # Titre affiché dans la documentation interactive sur /docs
    title="SmartDocs API",
    
    # Description affichée dans /docs
    description="""
    API RAG pour l'assistant documentaire SmartDocs.
    
    ## Fonctionnalités
    - 📄 Upload et ingestion de documents PDF
    - 🔍 Recherche hybride (vectorielle + BM25)
    - 🧠 Génération de réponses via Mistral (local) ou Groq (cloud)
    - 📊 Évaluation RAGAS des réponses
    - 🏢 Gestion multi-workspace
    """,
    
    # Version de l'API — à incrémenter à chaque release
    version="1.0.0",
    
    # URL de la documentation interactive Swagger
    docs_url="/docs",
    
    # URL de la documentation ReDoc (alternative à Swagger)
    redoc_url="/redoc",
)


# ── Configuration CORS ────────────────────────────────────────────────────────
# CORS (Cross-Origin Resource Sharing) : mécanisme de sécurité des navigateurs
# Sans cette configuration, le frontend Next.js ne peut pas appeler le backend
# car ils tournent sur des ports différents (3000 vs 8000)
app.add_middleware(
    CORSMiddleware,
    
    # Liste des origines autorisées à faire des requêtes
    # En développement : localhost:3000 (Next.js)
    # En production : ajouter le domaine de déploiement
    allow_origins=[
        settings.FRONTEND_URL,      # http://localhost:3000
        "http://localhost:3000",     # fallback explicite
        "http://127.0.0.1:3000",    # alternative localhost
    ],
    
    # Autorise les cookies et headers d'authentification
    allow_credentials=True,
    
    # Méthodes HTTP autorisées
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    
    # Headers HTTP autorisés dans les requêtes
    allow_headers=["*"],
)


# ── Enregistrement des routers ────────────────────────────────────────────────
# Chaque router gère un groupe d'endpoints
# Le prefix définit le début de l'URL de chaque groupe
# Les tags organisent les endpoints dans la doc Swagger

# Routes d'upload de documents PDF
# Endpoints : POST /api/upload
app.include_router(
    upload_router,
    prefix="/api",
    tags=["Upload"],
)

# Routes de questions/réponses RAG
# Endpoints : POST /api/ask
app.include_router(
    ask_router,
    prefix="/api",
    tags=["RAG"],
)

# Routes de gestion des workspaces
# Endpoints : GET/POST/DELETE /api/workspaces
app.include_router(
    workspaces_router,
    prefix="/api",
    tags=["Workspaces"],
)

# Routes d'évaluation RAGAS
# Endpoints : POST /api/evaluate
app.include_router(
    evaluation_router,
    prefix="/api",
    tags=["Evaluation"],
)


# ── Événements de démarrage et arrêt ─────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    """
    Exécuté automatiquement au démarrage du serveur.
    Vérifie que toutes les dépendances sont disponibles.
    """
    logger.info("=== Démarrage de SmartDocs API ===")
    logger.info("Frontend autorisé : {}", settings.FRONTEND_URL)
    logger.info("LLM local : {} ({})", settings.OLLAMA_MODEL, settings.OLLAMA_BASE_URL)
    logger.info("LLM cloud : {} (Groq)", settings.GROQ_DEFAULT_MODEL)
    logger.info("ChromaDB : {}", settings.CHROMA_PERSIST_DIR)
    logger.info("Documentation : http://localhost:{}/docs", settings.API_PORT)
    logger.info("=== SmartDocs API prête ===")


@app.on_event("shutdown")
async def shutdown_event():
    """
    Exécuté automatiquement à l'arrêt du serveur.
    Permet de fermer proprement les connexions ouvertes.
    """
    logger.info("=== Arrêt de SmartDocs API ===")


# ── Route de santé ────────────────────────────────────────────────────────────
@app.get(
    "/health",
    tags=["Santé"],
    summary="Vérifie que l'API est en ligne",
)
async def health_check():
    """
    Endpoint de santé — vérifie que le serveur répond.
    
    Utilisé par :
    - Docker pour vérifier que le container est sain
    - Le frontend pour savoir si le backend est disponible
    - Les outils de monitoring en production
    
    Returns:
        dict: statut et informations de base sur l'API
    """
    return {
        "status": "healthy",
        "app": "SmartDocs API",
        "version": "1.0.0",
        "docs": f"http://localhost:{settings.API_PORT}/docs",
    }


# ── Route racine ──────────────────────────────────────────────────────────────
@app.get(
    "/",
    tags=["Santé"],
    summary="Page d'accueil de l'API",
)
async def root():
    """
    Route racine — redirige vers la documentation.
    
    Returns:
        dict: message de bienvenue et lien vers /docs
    """
    return {
        "message": "Bienvenue sur SmartDocs API 🧠",
        "documentation": f"http://localhost:{settings.API_PORT}/docs",
        "health": f"http://localhost:{settings.API_PORT}/health",
    }