// frontend/lib/api.ts

// axios : client HTTP pour faire des requêtes vers le backend FastAPI
// Plus pratique que fetch natif : gestion d'erreurs, intercepteurs, timeout...
import axios from "axios";

// ── URL de base du backend ────────────────────────────────────────────────────
// Toutes les requêtes seront préfixées par cette URL
// En développement : FastAPI tourne sur le port 8000
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Instance axios configurée pour SmartDocs
// On la réutilise dans toutes les fonctions — pas besoin de reconfigurer à chaque fois
const apiClient = axios.create({
  baseURL: API_BASE_URL,

  // Timeout : annule la requête si le backend ne répond pas en 60 secondes
  // 60s car l'ingestion et la génération LLM peuvent prendre du temps
  timeout: 60000,

  headers: {
    "Content-Type": "application/json",
  },
});


// ── Types TypeScript ──────────────────────────────────────────────────────────
// On définit les types de données échangées avec le backend
// TypeScript vérifie que les données ont la bonne structure au moment de la compilation

// Source citée dans une réponse RAG
export interface Source {
  file: string;      // Nom du fichier PDF source
  page: number;      // Numéro de page dans le document
  score: number;     // Score de pertinence attribué par le reranker
  excerpt: string;   // Extrait du texte du chunk
}

// Informations sur le modèle LLM utilisé
export interface ModelInfo {
  provider: string;  // "groq" ou "ollama"
  name: string;      // Nom du modèle (ex: "llama-3.1-8b-instant")
}

// Réponse complète de l'endpoint /api/ask
export interface AskResponse {
  query: string;        // Question posée par l'utilisateur
  answer: string;       // Réponse générée par le LLM
  sources: Source[];    // Sources citées pour justifier la réponse
  model: ModelInfo;     // Modèle utilisé pour générer la réponse
  workspace_id: string; // Workspace dans lequel la recherche a été faite
}

// Réponse de l'endpoint /api/upload
export interface UploadResponse {
  status: string;      // "processing"
  message: string;     // Message de confirmation
  file_name: string;   // Nom du fichier uploadé
  workspace_id: string; // Workspace cible
}

// Structure d'un workspace
export interface Workspace {
  id: string;   // Identifiant unique (ex: "rh")
  name: string; // Nom affiché (ex: "Ressources Humaines")
}

// Paramètres d'une question RAG
export interface AskRequest {
  query: string;          // Question de l'utilisateur
  workspace_id: string;   // Workspace cible
  provider: string;       // "groq" ou "ollama"
  model?: string;         // Modèle spécifique (optionnel)
}


// ── Fonctions API ─────────────────────────────────────────────────────────────

/**
 * Upload un fichier PDF vers le backend pour ingestion.
 * 
 * On utilise FormData car on envoie un fichier binaire
 * et non du JSON — le Content-Type devient "multipart/form-data"
 * 
 * @param file - Fichier PDF à uploader
 * @param workspaceId - Workspace cible
 * @param onProgress - Callback appelé avec le pourcentage d'upload (0-100)
 */
export async function uploadDocument(
  file: File,
  workspaceId: string = "default",
  onProgress?: (progress: number) => void
): Promise<UploadResponse> {
  // FormData : format requis pour envoyer des fichiers via HTTP
  const formData = new FormData();

  // Ajoute le fichier au formulaire — "file" doit correspondre
  // au nom du paramètre dans la route FastAPI (file: UploadFile)
  formData.append("file", file);

  const response = await apiClient.post<UploadResponse>(
    `/api/upload?workspace_id=${workspaceId}`,
    formData,
    {
      // Override du Content-Type pour l'upload de fichier
      headers: { "Content-Type": "multipart/form-data" },

      // onUploadProgress : appelé régulièrement pendant l'upload
      // Permet d'afficher une barre de progression dans l'interface
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(progress);
        }
      },
    }
  );

  return response.data;
}


/**
 * Envoie une question au pipeline RAG et retourne la réponse avec les sources.
 * 
 * Pipeline déclenché côté backend :
 * Question → Hybrid Search → Reranking → LLM → Réponse + Sources
 * 
 * @param request - Question, workspace, provider et modèle
 */
export async function askQuestion(request: AskRequest): Promise<AskResponse> {
  const response = await apiClient.post<AskResponse>("/api/ask", request);
  return response.data;
}


/**
 * Récupère la liste de tous les workspaces disponibles.
 * 
 * Appelé au chargement de l'interface pour peupler la sidebar.
 */
export async function getWorkspaces(): Promise<Workspace[]> {
  const response = await apiClient.get<{ workspaces: Workspace[] }>(
    "/api/workspaces"
  );
  return response.data.workspaces;
}


/**
 * Vérifie que le backend FastAPI est bien en ligne.
 * 
 * Appelé au chargement de l'interface pour afficher
 * un indicateur de statut de connexion.
 */
export async function checkHealth(): Promise<boolean> {
  try {
    await apiClient.get("/health");
    return true;
  } catch {
    // Si le backend ne répond pas → retourne false
    // L'interface affichera un message d'erreur de connexion
    return false;
  }
}