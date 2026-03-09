from fastapi import APIRouter

router = APIRouter()

@router.get("/workspaces", summary="Liste tous les workspaces disponibles")
async def list_workspaces():
    return {
        "workspaces": [
            {"id": "default", "name": "Général"},
            {"id": "rh", "name": "Ressources Humaines"},
            {"id": "juridique", "name": "Juridique"},
            {"id": "produit", "name": "Produit"},
        ]
    }
