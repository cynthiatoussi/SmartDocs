# backend/app/routes/upload.py

import os
import shutil
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.logger import logger
from app.services.ingestion import ingest_document

# APIRouter : permet de grouper les routes liées à l'upload
# Enregistré dans main.py avec le prefix /api
router = APIRouter()

# Dossier de stockage des PDFs uploadés
UPLOAD_DIR = "./data/documents"


@router.post(
    "/upload",
    summary="Upload et ingestion d'un document PDF",
)
async def upload_document(
    # UploadFile : objet FastAPI qui représente le fichier uploadé
    file: UploadFile = File(...),
    
    # workspace_id : espace de travail cible
    # Query parameter — ex: POST /api/upload?workspace_id=rh
    workspace_id: str = "default",
    
    # BackgroundTasks : permet de lancer l'ingestion en arrière-plan
    # L'API répond immédiatement sans attendre la fin de l'ingestion
    background_tasks: BackgroundTasks = None,
):
    """
    Reçoit un PDF, le sauvegarde et lance l'ingestion RAG.
    
    Pipeline déclenché :
    PDF reçu → sauvegarde → chunks → embeddings → ChromaDB
    """
    logger.info("Upload reçu : {} (workspace: {})", file.filename, workspace_id)
    
    # ── Validation du fichier ─────────────────────────────────────
    # Vérifie que le fichier est bien un PDF
    if not file.filename.endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Seuls les fichiers PDF sont acceptés"
        )
    
    # Vérifie la taille — limite à 50 Mo
    # 50 Mo = 50 * 1024 * 1024 bytes
    MAX_SIZE = 50 * 1024 * 1024
    contents = await file.read()
    
    if len(contents) > MAX_SIZE:
        raise HTTPException(
            status_code=400,
            detail="Fichier trop lourd — maximum 50 Mo"
        )
    
    # ── Sauvegarde du fichier ─────────────────────────────────────
    # Crée le dossier de destination s'il n'existe pas
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    
    # Chemin complet du fichier sauvegardé
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    
    # Écrit le contenu du fichier sur le disque
    with open(file_path, "wb") as f:
        f.write(contents)
    
    logger.info("Fichier sauvegardé : {}", file_path)
    
    # ── Ingestion en arrière-plan ─────────────────────────────────
    # add_task lance l'ingestion sans bloquer la réponse API
    # Le frontend recevra la réponse immédiatement
    # puis suivra la progression via WebSocket
    background_tasks.add_task(
        ingest_document,
        file_path=file_path,
        file_name=file.filename,
        workspace_id=workspace_id,
    )
    
    return JSONResponse(
        status_code=202,  # 202 Accepted : traitement en cours
        content={
            "status": "processing",
            "message": f"Ingestion de '{file.filename}' lancée en arrière-plan",
            "file_name": file.filename,
            "workspace_id": workspace_id,
        }
    )