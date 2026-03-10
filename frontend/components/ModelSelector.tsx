// frontend/components/ModelSelector.tsx

"use client";

import { useState } from "react";

import {
  Cpu,        // Icône CPU — modèle local (Ollama)
  Cloud,      // Icône nuage — modèle cloud (Groq)
  ChevronDown, // Icône chevron — dropdown ouvert/fermé
  Zap,        // Icône éclair — rapidité (Groq)
  Lock,       // Icône cadenas — confidentialité (Ollama)
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Model {
  id: string;          // Identifiant envoyé au backend
  name: string;        // Nom affiché dans l'interface
  provider: "groq" | "ollama"; // Fournisseur du modèle
  description: string; // Description courte du modèle
  badge: string;       // Badge affiché (ex: "Rapide", "Local")
  badgeColor: string;  // Couleur du badge Tailwind
}

interface ModelSelectorProps {
  // Modèle actuellement sélectionné
  selectedModel: string;

  // Provider actuellement sélectionné
  selectedProvider: string;

  // Callback appelé quand l'utilisateur change de modèle
  onModelChange: (modelId: string, provider: string) => void;
}


// ── Liste des modèles disponibles ─────────────────────────────────────────────
const AVAILABLE_MODELS: Model[] = [
  {
    id: "llama-3.1-8b-instant",
    name: "LLaMA 3.1 8B",
    provider: "groq",
    description: "Rapide et efficace — idéal pour la plupart des questions",
    badge: "Rapide",
    badgeColor: "bg-blue-500",
  },
  {
    id: "llama-3.3-70b-versatile",
    name: "LLaMA 3.3 70B",
    provider: "groq",
    description: "Très puissant — meilleure compréhension des documents complexes",
    badge: "Puissant",
    badgeColor: "bg-purple-500",
  },
  {
    id: "mixtral-8x7b-32768",
    name: "Mixtral 8x7B",
    provider: "groq",
    description: "Long contexte — parfait pour les documents très longs",
    badge: "Long contexte",
    badgeColor: "bg-orange-500",
  },
  {
    id: "mistral",
    name: "Mistral 7B",
    provider: "ollama",
    description: "100% local et privé — aucune donnée ne quitte ton PC",
    badge: "Local",
    badgeColor: "bg-green-500",
  },
];


export default function ModelSelector({
  selectedModel,
  selectedProvider,
  onModelChange,
}: ModelSelectorProps) {

  // ── État local ──────────────────────────────────────────────────
  // Contrôle l'ouverture/fermeture du dropdown
  const [isOpen, setIsOpen] = useState(false);

  // Récupère le modèle actuellement sélectionné pour l'affichage
  const currentModel = AVAILABLE_MODELS.find(
    (m) => m.id === selectedModel
  ) || AVAILABLE_MODELS[0];


  // ── Rendu ────────────────────────────────────────────────────────
  return (
    <div className="relative">

      {/* ── Bouton déclencheur du dropdown ───────────────────────── */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-gray-800 
                   hover:bg-gray-700 border border-gray-600 rounded-lg 
                   text-sm text-white transition-all duration-150"
      >
        {/* Icône selon le provider */}
        {currentModel.provider === "ollama"
          ? <Cpu size={14} className="text-green-400" />
          : <Cloud size={14} className="text-blue-400" />
        }

        {/* Nom du modèle actuel */}
        <span className="font-medium">{currentModel.name}</span>

        {/* Badge du modèle */}
        <span className={`
          text-xs px-1.5 py-0.5 rounded-full text-white
          ${currentModel.badgeColor}
        `}>
          {currentModel.badge}
        </span>

        {/* Chevron — tourne quand le dropdown est ouvert */}
        <ChevronDown
          size={14}
          className={`text-gray-400 transition-transform duration-200
            ${isOpen ? "rotate-180" : ""}`}
        />
      </button>


      {/* ── Dropdown — liste des modèles ─────────────────────────── */}
      {isOpen && (
        <>
          {/* Overlay transparent — ferme le dropdown si on clique ailleurs */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Liste des modèles */}
          <div className="absolute bottom-full mb-2 left-0 z-20 w-80
                          bg-gray-800 border border-gray-600 rounded-xl 
                          shadow-2xl overflow-hidden">

            {/* Section Groq */}
            <div className="p-2">
              <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
                <Cloud size={12} className="text-blue-400" />
                <span className="text-xs text-gray-400 uppercase tracking-wider">
                  Groq — Cloud
                </span>
                <Zap size={12} className="text-yellow-400" />
              </div>

              {/* Modèles Groq */}
              {AVAILABLE_MODELS.filter((m) => m.provider === "groq").map((model) => (
                <button
                  key={model.id}
                  onClick={() => {
                    onModelChange(model.id, model.provider);
                    setIsOpen(false);
                  }}
                  className={`
                    w-full flex items-start gap-3 px-3 py-2.5 rounded-lg
                    text-left transition-all duration-150
                    ${selectedModel === model.id
                      ? "bg-indigo-600 text-white"
                      : "text-gray-300 hover:bg-gray-700"
                    }
                  `}
                >
                  <Cloud size={14} className="text-blue-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{model.name}</span>
                      <span className={`
                        text-xs px-1.5 py-0.5 rounded-full text-white shrink-0
                        ${model.badgeColor}
                      `}>
                        {model.badge}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {model.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            {/* Séparateur */}
            <div className="border-t border-gray-700 mx-2" />

            {/* Section Ollama */}
            <div className="p-2">
              <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
                <Cpu size={12} className="text-green-400" />
                <span className="text-xs text-gray-400 uppercase tracking-wider">
                  Ollama — Local
                </span>
                <Lock size={12} className="text-green-400" />
              </div>

              {/* Modèles Ollama */}
              {AVAILABLE_MODELS.filter((m) => m.provider === "ollama").map((model) => (
                <button
                  key={model.id}
                  onClick={() => {
                    onModelChange(model.id, model.provider);
                    setIsOpen(false);
                  }}
                  className={`
                    w-full flex items-start gap-3 px-3 py-2.5 rounded-lg
                    text-left transition-all duration-150
                    ${selectedModel === model.id
                      ? "bg-indigo-600 text-white"
                      : "text-gray-300 hover:bg-gray-700"
                    }
                  `}
                >
                  <Cpu size={14} className="text-green-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{model.name}</span>
                      <span className={`
                        text-xs px-1.5 py-0.5 rounded-full text-white shrink-0
                        ${model.badgeColor}
                      `}>
                        {model.badge}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {model.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}