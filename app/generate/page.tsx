"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  Code2,
  Frame,
  ImagePlus,
  LogOut,
  Paperclip,
  Shuffle,
  Sparkles,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import "./generate.css";

const heroVideo =
  "https://framerusercontent.com/assets/iWlVr4qV5BuFxjhc6g7QcPK5o.mp4";

const examplePrompts = [
  "Loyalty punch card for a coffee shop",
  "Digital menu for a coffee shop",
  "Wholesale order form for an indie food brand",
  "CRM for a salon",
  "Inventory tracker for a jewelry store",
];

export default function GeneratePage() {
  return (
    <Suspense fallback={null}>
      <GenerateExperience />
    </Suspense>
  );
}

function GenerateExperience() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [figmaLink, setFigmaLink] = useState("");
  const [fileName, setFileName] = useState("");
  const [generationError, setGenerationError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const authStatus = searchParams.get("auth");

    if (authStatus !== "login" && authStatus !== "signup") {
      return;
    }

    setSuccessMessage(authStatus === "signup" ? "Account created successfully." : "Welcome back. You are signed in.");
    router.replace("/generate", { scroll: false });

    const timer = window.setTimeout(() => setSuccessMessage(""), 4200);
    return () => window.clearTimeout(timer);
  }, [router, searchParams]);

  function handleGenerate() {
    const prompt = figmaLink.trim();

    if (!prompt) {
      setGenerationError("Add a Figma link or describe what you want to build first.");
      return;
    }

    setGenerationError("");
    window.sessionStorage.setItem(
      "mosaic.pendingGeneration",
      JSON.stringify({
        figmaLink: prompt.includes("figma.com") ? prompt : undefined,
        prompt,
        requestedAt: new Date().toISOString(),
      }),
    );
    router.push("/workspace");
  }

  function handleImportFigma() {
    const prompt = figmaLink.trim();

    if (!prompt.includes("figma.com")) {
      setGenerationError("Paste a Figma design URL in the prompt box, then click Import Figma.");
      return;
    }

    handleGenerate();
  }

  return (
    <main className="generate-page">
      <video
        className="generate-background-video"
        aria-hidden="true"
        autoPlay
        muted
        loop
        playsInline
        src={heroVideo}
      />
      <div className="generate-glow" aria-hidden="true" />

      <header className="generate-header">
        <a className="brand" href="/generate">
          <span className="brand-mark" aria-hidden="true" />
          <span>Mosaic</span>
        </a>

        <div className="generate-header-center">
          <span className="generate-status-dot" />
          AI workspace
        </div>

        <button className="generate-back-link" onClick={() => signOut({ callbackUrl: "/" })} type="button">
          <LogOut size={16} />
          Log out
        </button>
      </header>

      {successMessage && (
        <div className="generate-success-toast" role="status" aria-live="polite">
          <CheckCircle2 size={18} />
          <span>{successMessage}</span>
        </div>
      )}

      <section className="generate-hero">
        <div className="generate-copy">
          <div className="generate-kicker">
            <Sparkles size={14} />
            Figma to frontend
          </div>

          <h1>
            Turn your Figma designs into{" "}
            <em>production-ready code.</em>
          </h1>

          <p>
            Paste a Figma file link, add any visual references, and let Mosaic
            build a clean, responsive frontend foundation in minutes.
          </p>
        </div>

        <div className="generate-composer">
          <div className="generate-composer-topline">
            <span>
              <Frame size={16} />
              New generation
            </span>
            <span className="generate-model">Mosaic v1</span>
          </div>

          <label className="generate-field-label" htmlFor="figma-link">
            Prompt or Figma file URL
          </label>
          <textarea
            id="figma-link"
            rows={3}
            placeholder="Paste a Figma link or describe what you want to build..."
            value={figmaLink}
            onChange={(event) => setFigmaLink(event.target.value)}
          />

          <div className="generate-toolbar">
            <div className="generate-attachments">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(event) =>
                  setFileName(event.target.files?.[0]?.name ?? "")
                }
              />
              <button
                className="generate-attach-button"
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                {fileName ? <ImagePlus size={17} /> : <Paperclip size={17} />}
                <span>{fileName || "Add reference"}</span>
              </button>
            </div>

            <div className="generate-actions">
              <button
                className="generate-figma-button"
                onClick={handleImportFigma}
                type="button"
              >
                Import Figma
                <FigmaLogo />
              </button>

              <button
                className="generate-run-button"
                onClick={handleGenerate}
                type="button"
                disabled={!figmaLink.trim()}
              >
                Generate code
                <ArrowUpRight size={17} />
              </button>
            </div>
          </div>

          {generationError && <p className="generate-error-message">{generationError}</p>}
        </div>

        <div className="generate-prompt-suggestions" aria-label="Example prompts">
          <p>
            Not sure where to start? Try these
            <Shuffle size={15} />
          </p>

          <div className="generate-suggestion-list">
            {examplePrompts.map((prompt, index) => (
              <button
                className="generate-suggestion-chip"
                key={prompt}
                onClick={() => setFigmaLink(prompt)}
                type="button"
              >
                <span className={`generate-chip-orb generate-chip-orb-${index + 1}`} aria-hidden="true" />
                {prompt}
              </button>
            ))}
          </div>
        </div>

        <div className="generate-benefits" aria-label="Generation features">
          <span>
            <Code2 size={15} />
            Clean React code
          </span>
          <span>Responsive by default</span>
          <span>Editable components</span>
        </div>
      </section>
    </main>
  );
}

function FigmaLogo() {
  return (
    <svg aria-hidden="true" className="figma-logo" viewBox="0 0 24 24">
      <path d="M8 2h4v8H8a4 4 0 0 1 0-8z" fill="#f24e1e" />
      <path d="M12 2h4a4 4 0 0 1 0 8h-4V2z" fill="#ff7262" />
      <path d="M12 10h4a4 4 0 1 1-4 4v-4z" fill="#1abcfe" />
      <path d="M8 10h4v8H8a4 4 0 0 1 0-8z" fill="#a259ff" />
      <path d="M8 18h4v2a4 4 0 1 1-4-4h4v2H8z" fill="#0acf83" />
    </svg>
  );
}
