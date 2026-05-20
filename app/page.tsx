"use client";

import { useState, useCallback, DragEvent, ChangeEvent } from "react";
import { UploadCloud, FileText, Settings2, Download, Loader2, X } from "lucide-react";
import { generateBooklet, BookletOptions } from "@/utils/pdfGenerator";

// ─── Types ────────────────────────────────────────────────────────────────────

type NUp = BookletOptions["nUp"];

interface NUpOption {
  value: NUp;
  label: string;
  description: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const N_UP_OPTIONS: NUpOption[] = [
  { value: 2,  label: "2-up",  description: "1 × 2 grid — ideal for booklets" },
  { value: 4,  label: "4-up",  description: "2 × 2 grid" },
  { value: 9,  label: "9-up",  description: "3 × 3 grid" },
  { value: 16, label: "16-up", description: "4 × 4 grid" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function Home() {
  const [file, setFile]           = useState<File | null>(null);
  const [nUp, setNUp]             = useState<NUp>(2);
  const [addBorder, setAddBorder] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus]       = useState<"idle" | "processing" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg]   = useState("");

  // ── File acceptance ────────────────────────────────────────────────────────

  const acceptFile = useCallback((f: File) => {
    if (f.type !== "application/pdf") {
      setErrorMsg("Only PDF files are supported.");
      setStatus("error");
      return;
    }
    setFile(f);
    setStatus("idle");
    setErrorMsg("");
  }, []);

  // ── Drag-and-drop handlers ─────────────────────────────────────────────────

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) acceptFile(dropped);
  };

  const onFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (picked) acceptFile(picked);
  };

  // ── Process & download ─────────────────────────────────────────────────────

  const handleProcess = async () => {
    if (!file) return;
    setStatus("processing");
    setErrorMsg("");
    try {
      const blob = await generateBooklet({ nUp, addBorder, file });

      // Build filename: strip .pdf extension, append suffix, re-add .pdf
      const baseName = file.name.replace(/\.pdf$/i, "");
      const outName  = `${baseName}_booklet_optimized.pdf`;

      // Trigger browser download via a temporary anchor element
      const url = URL.createObjectURL(blob);
      const a   = document.createElement("a");
      a.href     = url;
      a.download = outName;
      a.click();
      URL.revokeObjectURL(url);

      setStatus("done");
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : "Unknown error occurred.");
      setStatus("error");
    }
  };

  const clearFile = () => {
    setFile(null);
    setStatus("idle");
    setErrorMsg("");
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-xl space-y-6">

        {/* ── Header ── */}
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Booklet Imposition Tool</h1>
          <p className="text-gray-400 text-sm">
            Upload a PDF, choose a grid layout, and download a print-ready booklet.
            Everything runs in your browser — nothing is uploaded.
          </p>
        </div>

        {/* ── Drop Zone ── */}
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`relative rounded-2xl border-2 border-dashed transition-colors cursor-pointer
            ${isDragging
              ? "border-indigo-400 bg-indigo-950/40"
              : "border-gray-700 bg-gray-900 hover:border-gray-500"
            }`}
        >
          <label className="flex flex-col items-center justify-center gap-3 p-10 cursor-pointer">
            <input
              type="file"
              accept="application/pdf"
              className="sr-only"
              onChange={onFileInput}
            />
            {file ? (
              <>
                <FileText className="w-10 h-10 text-indigo-400" />
                <span className="font-medium text-indigo-300 text-sm text-center break-all">
                  {file.name}
                </span>
                <span className="text-xs text-gray-500">
                  {(file.size / 1024).toFixed(1)} KB — click or drop to replace
                </span>
              </>
            ) : (
              <>
                <UploadCloud className="w-10 h-10 text-gray-500" />
                <span className="text-gray-400 text-sm">
                  Drag &amp; drop a PDF here, or <span className="text-indigo-400 underline">browse</span>
                </span>
              </>
            )}
          </label>

          {/* Clear button */}
          {file && (
            <button
              onClick={(e) => { e.preventDefault(); clearFile(); }}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-200 transition-colors"
              aria-label="Remove file"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* ── Settings Panel ── */}
        <div className="bg-gray-900 rounded-2xl p-5 space-y-5 border border-gray-800">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-300">
            <Settings2 className="w-4 h-4" />
            Layout Settings
          </div>

          {/* N-up selector */}
          <div className="space-y-2">
            <label className="text-xs text-gray-400 uppercase tracking-wider">Grid Layout (N-up)</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {N_UP_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setNUp(opt.value)}
                  className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors text-left
                    ${nUp === opt.value
                      ? "border-indigo-500 bg-indigo-900/50 text-indigo-200"
                      : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-500"
                    }`}
                >
                  <div className="font-bold">{opt.label}</div>
                  <div className="text-xs opacity-70 mt-0.5">{opt.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Border toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={addBorder}
                onChange={(e) => setAddBorder(e.target.checked)}
              />
              <div className="w-10 h-6 rounded-full bg-gray-700 peer-checked:bg-indigo-600 transition-colors" />
              <div className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
            </div>
            <span className="text-sm text-gray-300">Add 1px border around each page</span>
          </label>
        </div>

        {/* ── Error message ── */}
        {status === "error" && (
          <div className="rounded-xl bg-red-950/60 border border-red-800 px-4 py-3 text-sm text-red-300">
            {errorMsg || "Something went wrong. Please try again."}
          </div>
        )}

        {/* ── Success message ── */}
        {status === "done" && (
          <div className="rounded-xl bg-green-950/60 border border-green-800 px-4 py-3 text-sm text-green-300">
            ✓ Booklet generated and downloaded successfully!
          </div>
        )}

        {/* ── Action Button ── */}
        <button
          onClick={handleProcess}
          disabled={!file || status === "processing"}
          className={`w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold transition-all
            ${!file || status === "processing"
              ? "bg-gray-800 text-gray-500 cursor-not-allowed"
              : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/40"
            }`}
        >
          {status === "processing" ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing…
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Process &amp; Download Booklet
            </>
          )}
        </button>

        <p className="text-center text-xs text-gray-600">
          Output: A4 portrait · pdf-lib · 100% client-side
        </p>
      </div>
    </main>
  );
}
