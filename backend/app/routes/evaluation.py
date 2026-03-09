from fastapi import APIRouter

router = APIRouter()

@router.get("/evaluate", summary="Retourne les métriques RAGAS")
async def evaluate():
    return {"status": "coming soon"}
