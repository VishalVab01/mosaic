"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Code2,
  Copy,
  Eye,
  Loader2,
  LogOut,
  Monitor,
  Send,
  Sparkles,
} from "lucide-react";
import { signOut } from "next-auth/react";
import "./workspace.css";

type Generation = {
  title: string;
  summary: string;
  html: string;
  css: string;
  js?: string;
  notes?: string[];
  prompt: string;
  generatedAt?: string;
};

type WorkspaceTab = "preview" | "code";
type CodeTab = "html" | "css" | "js";

const emptyGeneration: Generation = {
  title: "Start a new Mosaic generation",
  summary: "Describe an app or paste a Figma link on the generate page to create a live preview here.",
  html: `<main class="empty-preview">
  <div class="empty-orb">M</div>
  <h1>Your generated app appears here</h1>
  <p>Go back to the generator, enter a prompt, and Mosaic will build a preview with code.</p>
</main>`,
  css: `.empty-preview {
  min-height: 100vh;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 16px;
  background: #f4f7fb;
  color: #101114;
  font-family: Inter, Arial, sans-serif;
  text-align: center;
}
.empty-orb {
  width: 82px;
  height: 82px;
  border-radius: 26px;
  display: grid;
  place-items: center;
  background: #080808;
  color: white;
  font-size: 34px;
  font-weight: 800;
}
h1 { margin: 0; font-size: clamp(32px, 5vw, 56px); }
p { max-width: 460px; margin: 0; color: #5d6675; line-height: 1.6; }`,
  js: "",
  notes: ["No generation loaded yet."],
  prompt: "",
};

export default function WorkspacePage() {
  const [generation, setGeneration] = useState<Generation>(emptyGeneration);
  const [prompt, setPrompt] = useState("");
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("preview");
  const [codeTab, setCodeTab] = useState<CodeTab>("html");
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    const stored = window.sessionStorage.getItem("mosaic.latestGeneration");

    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored) as Generation;
      setGeneration(parsed);
      setPrompt(parsed.prompt ?? "");
    } catch {
      window.sessionStorage.removeItem("mosaic.latestGeneration");
    }
  }, []);

  const previewDocument = useMemo(() => createPreviewDocument(generation), [generation]);
  const codeMap = useMemo(
    () => ({
      html: generation.html,
      css: generation.css,
      js: generation.js || "// No JavaScript was needed for this generation.",
    }),
    [generation],
  );

  async function regenerate() {
    const nextPrompt = prompt.trim();

    if (!nextPrompt) {
      setStatusMessage("Add a prompt before generating.");
      return;
    }

    setIsGenerating(true);
    setStatusMessage("Generating a fresh version...");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          figmaLink: nextPrompt.includes("figma.com") ? nextPrompt : undefined,
          prompt: nextPrompt,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { generation?: Omit<Generation, "prompt">; error?: string } | null;

      if (!response.ok || !payload?.generation) {
        throw new Error(payload?.error ?? "Could not regenerate. Please try again.");
      }

      const nextGeneration = {
        ...payload.generation,
        prompt: nextPrompt,
        generatedAt: new Date().toISOString(),
      };

      setGeneration(nextGeneration);
      window.sessionStorage.setItem("mosaic.latestGeneration", JSON.stringify(nextGeneration));
      setWorkspaceTab("preview");
      setStatusMessage("Preview updated.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function copyCurrentCode() {
    await navigator.clipboard.writeText(codeMap[codeTab]);
    setStatusMessage(`${codeTab.toUpperCase()} copied to clipboard.`);
  }

  return (
    <main className="workspace-page">
      <aside className="workspace-sidebar">
        <div className="workspace-brand-row">
          <a className="workspace-brand" href="/generate">
            <span className="brand-mark" aria-hidden="true" />
            <span>Mosaic</span>
          </a>
          <button className="workspace-icon-button" onClick={() => signOut({ callbackUrl: "/" })} type="button" aria-label="Log out">
            <LogOut size={17} />
          </button>
        </div>

        <a className="workspace-back-link" href="/generate">
          <ArrowLeft size={16} />
          New generation
        </a>

        <section className="workspace-prompt-card">
          <div className="workspace-card-title">
            <Sparkles size={16} />
            Prompt
          </div>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Ask Mosaic to adjust layout, add screens, or generate a new app..."
          />
          <button className="workspace-generate-button" onClick={regenerate} disabled={isGenerating} type="button">
            {isGenerating ? <Loader2 className="workspace-spin" size={17} /> : <Send size={17} />}
            {isGenerating ? "Generating..." : "Generate"}
          </button>
        </section>

        <section className="workspace-result-card">
          <span className="workspace-pill">Latest result</span>
          <h1>{generation.title}</h1>
          <p>{generation.summary}</p>

          {generation.notes?.length ? (
            <ul>
              {generation.notes.slice(0, 4).map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : null}
        </section>

        {statusMessage && <p className="workspace-status">{statusMessage}</p>}
      </aside>

      <section className="workspace-stage">
        <header className="workspace-topbar">
          <div className="workspace-mode-tabs" aria-label="Workspace view">
            <button className={workspaceTab === "preview" ? "active" : ""} onClick={() => setWorkspaceTab("preview")} type="button">
              <Eye size={16} />
              Preview
            </button>
            <button className={workspaceTab === "code" ? "active" : ""} onClick={() => setWorkspaceTab("code")} type="button">
              <Code2 size={16} />
              Code
            </button>
          </div>

          <div className="workspace-device-pill">
            <Monitor size={16} />
            Responsive preview
          </div>
        </header>

        <div className="workspace-canvas">
          {workspaceTab === "preview" ? (
            <iframe title={`${generation.title} preview`} sandbox="allow-scripts" srcDoc={previewDocument} />
          ) : (
            <div className="workspace-code-shell">
              <div className="workspace-code-toolbar">
                <div className="workspace-code-tabs">
                  {(["html", "css", "js"] as CodeTab[]).map((tab) => (
                    <button className={codeTab === tab ? "active" : ""} key={tab} onClick={() => setCodeTab(tab)} type="button">
                      {tab.toUpperCase()}
                    </button>
                  ))}
                </div>
                <button className="workspace-copy-button" onClick={copyCurrentCode} type="button">
                  <Copy size={15} />
                  Copy
                </button>
              </div>
              <pre>
                <code>{codeMap[codeTab]}</code>
              </pre>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function createPreviewDocument(generation: Generation) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(generation.title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; }
    ${generation.css}
  </style>
</head>
<body>
${generation.html}
<script>
${(generation.js ?? "").replace(/<\/script/gi, "<\\/script")}
</script>
</body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
