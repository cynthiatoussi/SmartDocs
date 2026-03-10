// frontend/components/UploadZone.tsx

"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import { uploadDocument } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────
// États possibles de l'upload
type UploadStatus = "idle" | "uploading" | "success" | "error";

interface UploadZoneProps {
  // Workspace cible pour l'upload
  workspaceId: string;

  // Callback appelé quand l'upload est terminé avec succès
  onUploadSuccess: (fileName: string) => void;
}


export default function UploadZone({ workspaceId, onUploadSuccess }: UploadZoneProps) {

  // ── État local ──────────────────────────────────────────────────
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");


  // ── Fonction d'upload ─────────────────────────────────────────
  const handleUpload = useCallback(async (file: File) => {
    // Validation : seuls les PDFs sont acceptés
    if (!file.name.endsWith(".pdf")) {
      setStatus("error");
      setErrorMessage("Seuls les fichiers PDF sont acceptés");
      return;
    }

    // Validation : taille max 50 Mo
    if (file.size > 50 * 1024 * 1024) {
      setStatus("error");
      setErrorMessage("Fichier trop lourd — maximum 50 Mo");
      return;
    }

    setFileName(file.name);
    setStatus("uploading");
    setProgress(0);

    try {
      // Lance l'upload avec suivi de progression
      await uploadDocument(
        file,
        workspaceId,
        // Callback de progression — mis à jour en temps réel
        (uploadProgress) => setProgress(uploadProgress)
      );

      // Upload réussi
      setStatus("success");
      setProgress(100);
      onUploadSuccess(file.name);

      // Réinitialise après 3 secondes
      setTimeout(() => {
        setStatus("idle");
        setProgress(0);
        setFileName("");
      }, 3000);

    } catch {
      setStatus("error");
      setErrorMessage("Erreur lors de l'upload — vérifie que le backend est lancé");
    }
  }, [workspaceId, onUploadSuccess]);


  // ── Configuration du drag & drop ──────────────────────────────
  // useDropzone gère automatiquement les événements drag & drop
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      handleUpload(acceptedFiles[0]);
    }
  }, [handleUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    multiple: false,
    disabled: status === "uploading",
  });


  // ── Rendu selon le statut ─────────────────────────────────────
  return (
    <div className="w-full">

      {/* ── Zone de dépôt principale ────────────────────────────── */}
      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-xl p-6 text-center
          transition-all duration-200 cursor-pointer
          ${isDragActive
            ? "border-indigo-400 bg-indigo-950/30"
            : status === "uploading"
            ? "border-gray-600 bg-gray-800/30 cursor-not-allowed"
            : status === "success"
            ? "border-green-500 bg-green-950/20"
            : status === "error"
            ? "border-red-500 bg-red-950/20"
            : "border-gray-600 bg-gray-800/20 hover:border-indigo-500 hover:bg-indigo-950/10"
          }
        `}
      >
        <input {...getInputProps()} />

        {/* État repos ou drag actif */}
        {status === "idle" && (
          <div className="flex flex-col items-center gap-3">
            <div className={`
              w-12 h-12 rounded-xl flex items-center justify-center
              ${isDragActive ? "bg-indigo-600" : "bg-gray-700"}
              transition-colors duration-200
            `}>
              <Upload
                size={24}
                className={isDragActive ? "text-white" : "text-gray-400"}
              />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-300">
                {isDragActive
                  ? "Dépose ton PDF ici !"
                  : "Glisse un PDF ou clique pour sélectionner"
                }
              </p>
              <p className="text-xs text-gray-500 mt-1">
                PDF uniquement · Maximum 50 Mo
              </p>
            </div>
          </div>
        )}

        {/* État upload en cours */}
        {status === "uploading" && (
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 bg-indigo-600/20 rounded-xl flex items-center justify-center">
              <Loader2 size={24} className="text-indigo-400 animate-spin" />
            </div>
            <div className="w-full">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm text-gray-300 truncate flex-1 mr-2">
                  <FileText size={14} className="inline mr-1 text-indigo-400" />
                  {fileName}
                </p>
                <span className="text-xs text-indigo-400 font-mono shrink-0">
                  {progress}%
                </span>
              </div>
              {/* Barre de progression */}
              <div className="w-full bg-gray-700 rounded-full h-1.5">
                <div
                  className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Ingestion en cours — chunking + embeddings...
              </p>
            </div>
          </div>
        )}

        {/* État succès */}
        {status === "success" && (
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 bg-green-600/20 rounded-xl flex items-center justify-center">
              <CheckCircle size={24} className="text-green-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-green-400">
                Document indexé avec succès !
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {fileName} est prêt à être interrogé
              </p>
            </div>
          </div>
        )}

        {/* État erreur */}
        {status === "error" && (
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 bg-red-600/20 rounded-xl flex items-center justify-center">
              <XCircle size={24} className="text-red-400" />
            </div>
            <div>
             <p className="text-sm font-medium text-red-400">Erreur d&apos;upload</p>
              <p className="text-xs text-gray-500 mt-1">{errorMessage}</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setStatus("idle");
                setErrorMessage("");
              }}
              className="text-xs text-indigo-400 hover:text-indigo-300 underline transition-colors"
            >
              Réessayer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}