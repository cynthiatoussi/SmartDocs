// frontend/components/MessageBubble.tsx

"use client";

import { useState } from "react";
import {
  User,       // Icône utilisateur
  Brain,      // Icône IA — logo SmartDocs
  ChevronDown, // Icône chevron — afficher/masquer les sources
  ChevronUp,
  Cloud,      // Icône cloud — modèle Groq
  Cpu,        // Icône CPU — modèle Ollama
  BookOpen,   // Icône sources
} from "lucide-react";
import { Source, ModelInfo } from "@/lib/api";
import SourceCard from "./SourceCard";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface Message {
  // Identifiant unique du message
  id: string;

  // "user" : message de l'utilisateur | "assistant" : réponse de l'IA
  role: "user" | "assistant";

  // Contenu textuel du message
  content: string;

  // Sources citées — uniquement pour les messages "assistant"
  sources?: Source[];

  // Modèle utilisé — uniquement pour les messages "assistant"
  model?: ModelInfo;

  // Horodatage du message
  timestamp: Date;

  // Indique si le message est en cours de génération (streaming)
  isLoading?: boolean;
}

interface MessageBubbleProps {
  message: Message;
}


export default function MessageBubble({ message }: MessageBubbleProps) {

  // ── État local ──────────────────────────────────────────────────
  // Contrôle l'affichage des sources
  const [showSources, setShowSources] = useState(false);

  // Détermine si c'est un message utilisateur ou IA
  const isUser = message.role === "user";


  // ── Rendu ────────────────────────────────────────────────────────
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>

      {/* ── Avatar ───────────────────────────────────────────────── */}
      <div className={`
        w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-1
        ${isUser
          ? "bg-indigo-600"   // Avatar utilisateur : indigo
          : "bg-gray-700"     // Avatar IA : gris foncé
        }
      `}>
        {isUser
          ? <User size={16} className="text-white" />
          : <Brain size={16} className="text-indigo-400" />
        }
      </div>

      {/* ── Contenu du message ───────────────────────────────────── */}
      <div className={`
        flex flex-col gap-2 max-w-[75%]
        ${isUser ? "items-end" : "items-start"}
      `}>

        {/* ── Bulle de message ─────────────────────────────────── */}
        <div className={`
          px-4 py-3 rounded-2xl text-sm leading-relaxed
          ${isUser
            // Bulle utilisateur : fond indigo
            ? "bg-indigo-600 text-white rounded-tr-sm"
            // Bulle IA : fond gris foncé
            : "bg-gray-800 text-gray-100 rounded-tl-sm border border-gray-700"
          }
        `}>

          {/* Message en cours de génération → spinner */}
          {message.isLoading ? (
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {/* Animation de points clignotants */}
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
              <span className="text-xs text-gray-400">SmartDocs réfléchit...</span>
            </div>
          ) : (
            // Contenu du message — préserve les sauts de ligne
            <p className="whitespace-pre-wrap">{message.content}</p>
          )}
        </div>

        {/* ── Métadonnées — modèle utilisé + horodatage ─────────── */}
        {!isUser && !message.isLoading && (
          <div className="flex items-center gap-2 px-1">

            {/* Modèle utilisé */}
            {message.model && (
              <div className="flex items-center gap-1">
                {message.model.provider === "ollama"
                  ? <Cpu size={10} className="text-green-400" />
                  : <Cloud size={10} className="text-blue-400" />
                }
                <span className="text-xs text-gray-500">
                  {message.model.name}
                </span>
              </div>
            )}

            {/* Séparateur */}
            {message.model && <span className="text-gray-600 text-xs">·</span>}

            {/* Horodatage */}
            <span className="text-xs text-gray-600">
              {message.timestamp.toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        )}

        {/* Horodatage pour les messages utilisateur */}
        {isUser && (
          <span className="text-xs text-gray-600 px-1">
            {message.timestamp.toLocaleTimeString("fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}

        {/* ── Sources citées ───────────────────────────────────── */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="w-full">

            {/* Bouton pour afficher/masquer les sources */}
            <button
              onClick={() => setShowSources(!showSources)}
              className="flex items-center gap-2 px-2 py-1 rounded-lg
                         text-xs text-gray-400 hover:text-gray-200
                         hover:bg-gray-800 transition-all duration-150"
            >
              <BookOpen size={12} />
              <span>
                {message.sources.length} source
                {message.sources.length > 1 ? "s" : ""} citée
                {message.sources.length > 1 ? "s" : ""}
              </span>
              {showSources
                ? <ChevronUp size={12} />
                : <ChevronDown size={12} />
              }
            </button>

            {/* Liste des sources */}
            {showSources && (
              <div className="mt-2 space-y-2 w-full">
                {message.sources.map((source, i) => (
                  <SourceCard
                    key={i}
                    source={source}
                    index={i + 1}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}