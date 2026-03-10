// frontend/components/ChatWindow.tsx

"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send,         // Icône envoi
  Trash2,       // Icône supprimer
  MessageSquare, // Icône conversation vide
} from "lucide-react";
import { askQuestion, AskResponse } from "@/lib/api";
import MessageBubble, { Message } from "./MessageBubble";
import ModelSelector from "./ModelSelector";

interface ChatWindowProps {
  // Workspace actif — détermine dans quel index ChromaDB chercher
  workspaceId: string;
}


export default function ChatWindow({ workspaceId }: ChatWindowProps) {

  // ── État local ──────────────────────────────────────────────────
  // Liste de tous les messages de la conversation
  const [messages, setMessages] = useState<Message[]>([]);

  // Contenu de l'input de question
  const [input, setInput] = useState("");

  // Indique si une requête est en cours
  const [isLoading, setIsLoading] = useState(false);

  // Modèle sélectionné par l'utilisateur
  const [selectedModel, setSelectedModel] = useState("llama-3.1-8b-instant");

  // Provider sélectionné (groq ou ollama)
  const [selectedProvider, setSelectedProvider] = useState("groq");

  // Message d'erreur global
  const [error, setError] = useState<string | null>(null);

  // Référence vers le bas de la liste — pour le scroll automatique
  const bottomRef = useRef<HTMLDivElement>(null);

  // Référence vers l'input — pour le focus automatique
  const inputRef = useRef<HTMLTextAreaElement>(null);


  // ── Scroll automatique vers le bas ───────────────────────────────
  // Déclenché à chaque nouveau message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);


  // ── Réinitialise la conversation quand on change de workspace ────
  useEffect(() => {
    setMessages([]);
    setError(null);
  }, [workspaceId]);


  // ── Envoi d'une question ─────────────────────────────────────────
  const handleSubmit = async () => {
    // Ne rien faire si l'input est vide ou si une requête est en cours
    const query = input.trim();
    if (!query || isLoading) return;

    setError(null);
    setInput("");

    // ── Ajoute le message utilisateur immédiatement ───────────────
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: query,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // ── Ajoute un message IA "en cours" avec spinner ──────────────
    const loadingMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isLoading: true,
    };
    setMessages((prev) => [...prev, loadingMessage]);
    setIsLoading(true);

    try {
      // ── Appel au pipeline RAG ─────────────────────────────────
      const response: AskResponse = await askQuestion({
        query,
        workspace_id: workspaceId,
        provider: selectedProvider,
        model: selectedModel,
      });

      // ── Remplace le message "en cours" par la vraie réponse ───
      const assistantMessage: Message = {
        id: loadingMessage.id,
        role: "assistant",
        content: response.answer,
        sources: response.sources,
        model: response.model,
        timestamp: new Date(),
        isLoading: false,
      };

      setMessages((prev) =>
        // Remplace le dernier message (le spinner) par la vraie réponse
        prev.map((msg) =>
          msg.id === loadingMessage.id ? assistantMessage : msg
        )
      );

    } catch (err) {
      // ── Gestion d'erreur ──────────────────────────────────────
      // Remplace le spinner par un message d'erreur
      const errorMessage: Message = {
        id: loadingMessage.id,
        role: "assistant",
        content: "Désolée, une erreur est survenue. Vérifie que le backend est bien lancé et qu'un document est indexé dans ce workspace.",
        timestamp: new Date(),
        isLoading: false,
      };

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMessage.id ? errorMessage : msg
        )
      );
      setError("Erreur de connexion au backend");

    } finally {
      setIsLoading(false);
      // Remet le focus sur l'input après la réponse
      inputRef.current?.focus();
    }
  };


  // ── Envoi avec Entrée (Shift+Entrée pour saut de ligne) ──────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };


  // ── Rendu ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-gray-950">

      {/* ── En-tête du chat ─────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4
                      border-b border-gray-800 bg-gray-900">
        <div>
          <h2 className="text-sm font-semibold text-white">
            Workspace : {workspaceId}
          </h2>
          <p className="text-xs text-gray-500">
            {messages.filter((m) => m.role === "user").length} question
            {messages.filter((m) => m.role === "user").length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Bouton effacer la conversation */}
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                       text-xs text-gray-400 hover:text-red-400
                       hover:bg-red-950/20 transition-all duration-150"
          >
            <Trash2 size={12} />
            Effacer
          </button>
        )}
      </div>

      {/* ── Zone des messages ────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">

        {/* État vide — aucun message */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="w-16 h-16 bg-gray-800 rounded-2xl
                            flex items-center justify-center">
              <MessageSquare size={32} className="text-gray-600" />
            </div>
            <div className="text-center">
              <p className="text-gray-400 font-medium">
                Posez une question sur vos documents
              </p>
              <p className="text-gray-600 text-sm mt-1">
                Uploadez d&apos;abord un PDF dans le panneau de gauche
              </p>
            </div>

            {/* Suggestions de questions */}
            <div className="grid grid-cols-1 gap-2 mt-4 w-full max-w-md">
              {[
                "Quels sont les droits des personnes concernées ?",
                "Quelles sont les obligations du responsable de traitement ?",
                "Qu'est-ce que le principe de minimisation des données ?",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="text-left px-4 py-3 bg-gray-800/50 hover:bg-gray-800
                             border border-gray-700 hover:border-indigo-500/50
                             rounded-xl text-sm text-gray-400 hover:text-gray-200
                             transition-all duration-150"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Liste des messages */}
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {/* Ancre de scroll — toujours en bas */}
        <div ref={bottomRef} />
      </div>

      {/* ── Zone de saisie ───────────────────────────────────────── */}
      <div className="px-6 py-4 border-t border-gray-800 bg-gray-900">

        {/* Message d'erreur */}
        {error && (
          <div className="mb-3 px-3 py-2 bg-red-950/30 border border-red-800
                          rounded-lg text-xs text-red-400">
            {error}
          </div>
        )}

        <div className="flex items-end gap-3">

          {/* ── Input de question ──────────────────────────────── */}
          <div className="flex-1 bg-gray-800 border border-gray-700
                          hover:border-gray-600 focus-within:border-indigo-500
                          rounded-xl transition-all duration-150">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Posez une question sur vos documents... (Entrée pour envoyer)"
              rows={1}
              className="w-full bg-transparent px-4 py-3 text-sm text-white
                         placeholder-gray-500 resize-none outline-none
                         max-h-32 overflow-y-auto"
              style={{
                // Ajuste automatiquement la hauteur selon le contenu
                height: "auto",
                minHeight: "44px",
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = `${target.scrollHeight}px`;
              }}
              disabled={isLoading}
            />

            {/* Sélecteur de modèle — dans l'input */}
            <div className="flex items-center justify-between px-3 pb-2">
              <ModelSelector
                selectedModel={selectedModel}
                selectedProvider={selectedProvider}
                onModelChange={(modelId, provider) => {
                  setSelectedModel(modelId);
                  setSelectedProvider(provider);
                }}
              />
              <span className="text-xs text-gray-600">
                Shift+Entrée pour saut de ligne
              </span>
            </div>
          </div>

          {/* ── Bouton envoi ───────────────────────────────────── */}
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading}
            className={`
              w-11 h-11 rounded-xl flex items-center justify-center
              transition-all duration-150 shrink-0
              ${input.trim() && !isLoading
                // Actif : fond indigo
                ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                // Désactivé : fond gris
                : "bg-gray-800 text-gray-600 cursor-not-allowed"
              }
            `}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}