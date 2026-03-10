// frontend/components/SourceCard.tsx

"use client";

import { useState } from "react";
import {
  FileText,    // Icône fichier
  ChevronDown, // Icône chevron — expand/collapse
  ChevronUp,
  Star,        // Icône score de pertinence
} from "lucide-react";
import { Source } from "@/lib/api";

interface SourceCardProps {
  // Source à afficher
  source: Source;

  // Index de la source (1, 2, 3...) — affiché dans le badge
  index: number;
}


export default function SourceCard({ source, index }: SourceCardProps) {

  // ── État local ──────────────────────────────────────────────────
  // Contrôle l'affichage de l'extrait complet
  const [isExpanded, setIsExpanded] = useState(false);

  // Convertit le score en pourcentage lisible
  // Le score du reranker est entre -∞ et +∞ — on le normalise entre 0 et 100
  const scorePercent = source.score
    ? Math.min(100, Math.max(0, Math.round((source.score + 5) * 10)))
    : null;

  // Couleur du score selon sa valeur
  const scoreColor =
    scorePercent && scorePercent >= 70
      ? "text-green-400"   // Très pertinent
      : scorePercent && scorePercent >= 40
      ? "text-yellow-400"  // Moyennement pertinent
      : "text-red-400";    // Peu pertinent


  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden
                    hover:border-indigo-500/50 transition-all duration-200">

      {/* ── En-tête de la source ─────────────────────────────────── */}
      <div className="flex items-center gap-3 p-3">

        {/* Badge numéro de source */}
        <div className="w-6 h-6 bg-indigo-600 rounded-md flex items-center
                        justify-center text-xs font-bold text-white shrink-0">
          {index}
        </div>

        {/* Icône fichier */}
        <FileText size={14} className="text-indigo-400 shrink-0" />

        {/* Nom du fichier + page */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-200 truncate">
            {source.file}
          </p>
          <p className="text-xs text-gray-500">
            Page {source.page ?? "?"}
          </p>
        </div>

        {/* Score de pertinence */}
        {scorePercent !== null && (
          <div className="flex items-center gap-1 shrink-0">
            <Star size={10} className={scoreColor} />
            <span className={`text-xs font-mono ${scoreColor}`}>
              {scorePercent}%
            </span>
          </div>
        )}

        {/* Bouton expand/collapse */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-gray-500 hover:text-gray-300 transition-colors shrink-0"
        >
          {isExpanded
            ? <ChevronUp size={14} />
            : <ChevronDown size={14} />
          }
        </button>
      </div>

      {/* ── Extrait du texte — affiché si expanded ───────────────── */}
      {isExpanded && source.excerpt && (
        <div className="px-3 pb-3 border-t border-gray-700">
          <p className="text-xs text-gray-400 leading-relaxed mt-2 italic">
            &quot;{source.excerpt}&quot;
          </p>
        </div>
      )}
    </div>
  );
}