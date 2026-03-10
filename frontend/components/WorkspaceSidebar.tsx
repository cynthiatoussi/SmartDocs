// frontend/components/WorkspaceSidebar.tsx

"use client"; // Directive Next.js 14 — ce composant tourne côté client (navigateur)

import { useState, useEffect } from "react";

// lucide-react : bibliothèque d'icônes légères et modernes
import {
  FolderOpen,    // Icône dossier ouvert — workspace actif
  Folder,        // Icône dossier fermé — workspace inactif
  Brain,         // Icône cerveau — logo SmartDocs
  Wifi,          // Icône connexion — statut backend
  WifiOff,       // Icône déconnexion — backend hors ligne
  Plus,          // Icône + — ajouter un workspace
} from "lucide-react";

import { getWorkspaces, checkHealth, Workspace } from "@/lib/api";

// ── Props du composant ────────────────────────────────────────────────────────
interface WorkspaceSidebarProps {
  // Workspace actuellement sélectionné
  activeWorkspace: string;

  // Callback appelé quand l'utilisateur clique sur un workspace
  onWorkspaceChange: (workspaceId: string) => void;
}


export default function WorkspaceSidebar({
  activeWorkspace,
  onWorkspaceChange,
}: WorkspaceSidebarProps) {

  // ── État local ──────────────────────────────────────────────────
  // Liste des workspaces récupérés depuis le backend
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

  // Statut de connexion au backend — affiché en bas de la sidebar
  const [isBackendOnline, setIsBackendOnline] = useState<boolean>(false);

  // Chargement initial des workspaces
  const [isLoading, setIsLoading] = useState<boolean>(true);


  // ── Effets ───────────────────────────────────────────────────────
  useEffect(() => {
    // Fonction qui charge les workspaces et vérifie le backend
    const initialize = async () => {
      // Vérifie que le backend est en ligne
      const healthy = await checkHealth();
      setIsBackendOnline(healthy);

      if (healthy) {
        // Récupère la liste des workspaces depuis /api/workspaces
        const data = await getWorkspaces();
        setWorkspaces(data);
      }

      setIsLoading(false);
    };

    initialize();

    // Vérifie le statut du backend toutes les 30 secondes
    // Pour détecter si le backend tombe ou revient en ligne
    const interval = setInterval(async () => {
      const healthy = await checkHealth();
      setIsBackendOnline(healthy);
    }, 30000);

    // Nettoyage : annule l'intervalle quand le composant est démonté
    return () => clearInterval(interval);
  }, []); // [] = exécuté une seule fois au montage du composant


  // ── Rendu ────────────────────────────────────────────────────────
  return (
    <aside className="w-64 h-screen bg-gray-900 text-white flex flex-col border-r border-gray-700">

      {/* ── En-tête / Logo ───────────────────────────────────────── */}
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center gap-3">
          {/* Logo SmartDocs */}
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
            <Brain size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">SmartDocs</h1>
            <p className="text-xs text-gray-400">Assistant RAG</p>
          </div>
        </div>
      </div>

      {/* ── Liste des workspaces ─────────────────────────────────── */}
      <div className="flex-1 p-4 overflow-y-auto">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-3 px-2">
          Espaces de travail
        </p>

        {/* État de chargement */}
        {isLoading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-10 bg-gray-800 rounded-lg animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Backend hors ligne */}
        {!isLoading && !isBackendOnline && (
          <div className="text-center py-8">
            <WifiOff size={32} className="text-gray-600 mx-auto mb-2" />
            <p className="text-xs text-gray-500">Backend hors ligne</p>
            <p className="text-xs text-gray-600">Lance uvicorn pour commencer</p>
          </div>
        )}

        {/* Liste des workspaces */}
        {!isLoading && isBackendOnline && (
          <nav className="space-y-1">
            {workspaces.map((workspace) => {
              // Détermine si ce workspace est le workspace actif
              const isActive = workspace.id === activeWorkspace;

              return (
                <button
                  key={workspace.id}
                  onClick={() => onWorkspaceChange(workspace.id)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                    text-sm font-medium transition-all duration-150
                    ${isActive
                      // Workspace actif : fond indigo, texte blanc
                      ? "bg-indigo-600 text-white shadow-lg"
                      // Workspace inactif : transparent, texte gris
                      : "text-gray-400 hover:bg-gray-800 hover:text-white"
                    }
                  `}
                >
                  {/* Icône dossier — ouvert si actif, fermé sinon */}
                  {isActive
                    ? <FolderOpen size={16} />
                    : <Folder size={16} />
                  }
                  {workspace.name}
                </button>
              );
            })}
          </nav>
        )}
      </div>

      {/* ── Statut du backend ────────────────────────────────────── */}
      <div className="p-4 border-t border-gray-700">
        <div className="flex items-center gap-2 px-2">
          {isBackendOnline ? (
            <>
              {/* Point vert animé — backend en ligne */}
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <Wifi size={14} className="text-green-400" />
              <span className="text-xs text-green-400">Backend connecté</span>
            </>
          ) : (
            <>
              {/* Point rouge — backend hors ligne */}
              <div className="w-2 h-2 bg-red-400 rounded-full" />
              <WifiOff size={14} className="text-red-400" />
              <span className="text-xs text-red-400">Backend hors ligne</span>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}