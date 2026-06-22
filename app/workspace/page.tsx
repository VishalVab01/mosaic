"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUp,
  Bot,
  ChevronDown,
  Code2,
  Copy,
  Download,
  Eye,
  File,
  FileCode2,
  FolderOpen,
  Loader2,
  LogOut,
  Monitor,
  Plus,
  UserRound,
} from "lucide-react";
import { signOut } from "next-auth/react";
import "./workspace.css";

type GeneratedFile = {
  path: string;
  content: string;
};

type Generation = {
  title: string;
  summary: string;
  previewHtml: string;
  previewCss: string;
  previewJs?: string;
  files: GeneratedFile[];
  notes?: string[];
  prompt: string;
  generatedAt?: string;
};

type PendingGeneration = {
  figmaLink?: string;
  prompt: string;
  requestedAt?: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type WorkspaceTab = "preview" | "code";

const emptyGeneration: Generation = {
  title: "Start a new Mosaic generation",
  summary: "Describe an app or paste a Figma link to create a React + Tailwind project.",
  previewHtml: `<main class="empty-preview">
  <div class="empty-orb">M</div>
  <h1>Your generated app appears here</h1>
  <p>Send a prompt from the chat panel and Mosaic will build a React + Tailwind project.</p>
</main>`,
  previewCss: `.empty-preview {
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
  previewJs: "",
  files: createStarterFiles(),
  notes: ["No generation loaded yet."],
  prompt: "",
};

export default function WorkspacePage() {
  const [generation, setGeneration] = useState<Generation>(emptyGeneration);
  const [prompt, setPrompt] = useState("");
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("preview");
  const [selectedFilePath, setSelectedFilePath] = useState(emptyGeneration.files[0]?.path ?? "");
  const [fileSearch, setFileSearch] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Ready when you are. Ask Mosaic to build a React + Tailwind app and I will generate the preview plus project files.",
    },
  ]);
  const activeRequestRef = useRef("");

  useEffect(() => {
    const pending = readSessionJson<PendingGeneration>("mosaic.pendingGeneration");
    const stored = readSessionJson<Generation>("mosaic.latestGeneration");

    if (pending?.prompt) {
      window.sessionStorage.removeItem("mosaic.pendingGeneration");
      setPrompt(pending.prompt);
      void startGeneration(pending.prompt, {
        addUserMessage: true,
        figmaLink: pending.figmaLink,
        source: "initial",
      });
      return;
    }

    if (stored?.files?.length) {
      setGeneration(stored);
      setSelectedFilePath(stored.files[0]?.path ?? "");
      setPrompt(stored.prompt ?? "");
      setChatMessages([
        {
          id: "loaded",
          role: "assistant",
          text: `Loaded your latest React + Tailwind project: ${stored.title}. Ask Mosaic for changes from the composer below.`,
        },
      ]);
    }
  }, []);

  const previewDocument = useMemo(() => createPreviewDocument(generation), [generation]);
  const selectedFile = useMemo(
    () => generation.files.find((file) => file.path === selectedFilePath) ?? generation.files[0],
    [generation.files, selectedFilePath],
  );
  const fileTree = useMemo(() => buildFileTree(generation.files, fileSearch), [generation.files, fileSearch]);

  async function startGeneration(
    nextPrompt: string,
    options: { addUserMessage?: boolean; figmaLink?: string; source?: "initial" | "chat" } = {},
  ) {
    const cleanPrompt = nextPrompt.trim();

    if (!cleanPrompt) {
      setStatusMessage("Add a prompt before generating.");
      return;
    }

    const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    activeRequestRef.current = requestId;
    setIsGenerating(true);
    setWorkspaceTab("preview");
    setStatusMessage("Mosaic is building your React + Tailwind project...");
    setGeneration(createLoadingGeneration(cleanPrompt));
    setSelectedFilePath("src/App.jsx");

    setChatMessages((messages) => [
      ...messages,
      ...(options.addUserMessage ? [{ id: `${requestId}-user`, role: "user" as const, text: cleanPrompt }] : []),
      {
        id: `${requestId}-start`,
        role: "assistant",
        text:
          options.source === "initial"
            ? "Workspace opened instantly. I am planning the React components, Tailwind design system, and file structure now."
            : "Got it. I am rebuilding the React + Tailwind project from your latest instruction.",
      },
      {
        id: `${requestId}-build`,
        role: "assistant",
        text: "Generating src/App.jsx, Tailwind styles, config files, README, and a preview you can inspect immediately.",
      },
    ]);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          figmaLink: options.figmaLink ?? (cleanPrompt.includes("figma.com") ? cleanPrompt : undefined),
          prompt: cleanPrompt,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { generation?: Omit<Generation, "prompt">; error?: string } | null;

      if (!response.ok || !payload?.generation) {
        throw new Error(payload?.error ?? "Could not generate. Please try again.");
      }

      if (activeRequestRef.current !== requestId) {
        return;
      }

      const nextGeneration = normalizeGeneration({
        ...payload.generation,
        prompt: cleanPrompt,
        generatedAt: new Date().toISOString(),
      });

      setGeneration(nextGeneration);
      setSelectedFilePath(preferFile(nextGeneration.files));
      window.sessionStorage.setItem("mosaic.latestGeneration", JSON.stringify(nextGeneration));
      setStatusMessage("Preview updated.");
      setChatMessages((messages) => [
        ...messages,
        {
          id: `${requestId}-done`,
          role: "assistant",
          text: `Done - I built "${nextGeneration.title}" as a React + Tailwind project. You can preview it, inspect files, or download the ZIP.`,
        },
      ]);
    } catch (error) {
      if (activeRequestRef.current !== requestId) {
        return;
      }

      const message = error instanceof Error ? error.message : "Something went wrong.";
      setGeneration(emptyGeneration);
      setSelectedFilePath(emptyGeneration.files[0]?.path ?? "");
      setStatusMessage(message);
      setChatMessages((messages) => [
        ...messages,
        {
          id: `${requestId}-error`,
          role: "assistant",
          text: `I hit a problem while generating: ${message}`,
        },
      ]);
    } finally {
      if (activeRequestRef.current === requestId) {
        setIsGenerating(false);
      }
    }
  }

  function submitPrompt() {
    const nextPrompt = prompt.trim();

    if (!nextPrompt) {
      setStatusMessage("Add a prompt before generating.");
      return;
    }

    void startGeneration(nextPrompt, { addUserMessage: true, source: "chat" });
  }

  async function copyCurrentCode() {
    await navigator.clipboard.writeText(selectedFile?.content ?? "");
    setStatusMessage(`${selectedFile?.path ?? "File"} copied to clipboard.`);
  }

  function downloadZip() {
    const files = generation.files.length ? generation.files : emptyGeneration.files;
    const blob = createZipBlob(files);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${slugify(generation.title || "mosaic-project")}.zip`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatusMessage("Project ZIP downloaded.");
  }

  return (
    <main className="workspace-page">
      <aside className="workspace-sidebar">
        <div className="workspace-sidebar-top">
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
        </div>

        <section className="workspace-chat-panel" aria-label="AI generation chat">
          <div className="workspace-chat-messages">
            {generation.title !== emptyGeneration.title && (
              <div className="workspace-message assistant">
                <span className="workspace-message-avatar" aria-hidden="true">
                  <Bot size={15} />
                </span>
                <div className="workspace-message-card">
                  <span className="workspace-pill">{isGenerating ? "Building now" : "Latest result"}</span>
                  <h1>{generation.title}</h1>
                  <p>{generation.summary}</p>
                  {generation.notes?.length ? (
                    <ul>
                      {generation.notes.slice(0, 3).map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            )}

            {chatMessages.map((message) => (
              <div className={`workspace-message ${message.role}`} key={message.id}>
                <span className="workspace-message-avatar" aria-hidden="true">
                  {message.role === "assistant" ? <Bot size={15} /> : <UserRound size={15} />}
                </span>
                <p>{message.text}</p>
              </div>
            ))}
            {isGenerating && (
              <div className="workspace-message assistant">
                <span className="workspace-message-avatar" aria-hidden="true">
                  <Loader2 className="workspace-spin" size={15} />
                </span>
                <p>Generating components and polishing the preview...</p>
              </div>
            )}
          </div>

          <div className="workspace-chat-composer">
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  submitPrompt();
                }
              }}
              placeholder="Ask Mosaic..."
            />

            <div className="workspace-composer-actions">
              <button className="workspace-plus-button" type="button" aria-label="Attach reference">
                <Plus size={20} />
              </button>

              <div className="workspace-composer-right">
                <button className="workspace-build-menu" type="button">
                  Build
                  <ChevronDown size={15} />
                </button>
                <button className="workspace-send-button" onClick={submitPrompt} disabled={isGenerating} type="button" aria-label="Send prompt">
                  {isGenerating ? <Loader2 className="workspace-spin" size={18} /> : <ArrowUp size={20} />}
                </button>
              </div>
            </div>
          </div>

          {statusMessage && <p className="workspace-status">{statusMessage}</p>}
        </section>
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

          <div className="workspace-topbar-actions">
            <div className="workspace-device-pill">
              <Monitor size={16} />
              Responsive preview
            </div>
            <button className="workspace-download-button" onClick={downloadZip} type="button">
              <Download size={16} />
              Download ZIP
            </button>
          </div>
        </header>

        <div className="workspace-canvas">
          {workspaceTab === "preview" ? (
            <iframe title={`${generation.title} preview`} sandbox="allow-scripts" srcDoc={previewDocument} />
          ) : (
            <div className="workspace-code-shell">
              <aside className="workspace-file-explorer">
                <input
                  aria-label="Search code files"
                  className="workspace-file-search"
                  onChange={(event) => setFileSearch(event.target.value)}
                  placeholder="Search code"
                  type="search"
                  value={fileSearch}
                />

                <div className="workspace-file-tree">
                  {fileTree.map((node) => (
                    <FileTreeNode
                      key={node.path}
                      node={node}
                      selectedFilePath={selectedFile?.path ?? ""}
                      onSelect={setSelectedFilePath}
                    />
                  ))}
                </div>
              </aside>

              <div className="workspace-editor-pane">
                <div className="workspace-editor-toolbar">
                  <div className="workspace-editor-tab">
                    <FileCode2 size={15} />
                    {selectedFile?.path ?? "No file selected"}
                  </div>
                  <div className="workspace-editor-actions">
                    <button className="workspace-copy-button" onClick={copyCurrentCode} type="button">
                      <Copy size={15} />
                      Copy
                    </button>
                    <button className="workspace-copy-button" onClick={downloadZip} type="button">
                      <Download size={15} />
                      Download
                    </button>
                  </div>
                </div>

                <pre className="workspace-code-editor">
                  <code>
                    {formatCodeWithLines(selectedFile?.content ?? "").map((line) => (
                      <span className="workspace-code-line" key={line.number}>
                        <span className="workspace-line-number">{line.number}</span>
                        <span className="workspace-line-content">{line.content || " "}</span>
                      </span>
                    ))}
                  </code>
                </pre>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

type FileTreeNodeType = {
  children: FileTreeNodeType[];
  name: string;
  path: string;
  type: "folder" | "file";
};

function FileTreeNode({
  node,
  onSelect,
  selectedFilePath,
}: {
  node: FileTreeNodeType;
  onSelect: (path: string) => void;
  selectedFilePath: string;
}) {
  if (node.type === "folder") {
    return (
      <div className="workspace-tree-group">
        <div className="workspace-tree-folder">
          <FolderOpen size={16} />
          {node.name}
        </div>
        <div className="workspace-tree-children">
          {node.children.map((child) => (
            <FileTreeNode key={child.path} node={child} onSelect={onSelect} selectedFilePath={selectedFilePath} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <button
      className={`workspace-tree-file ${selectedFilePath === node.path ? "active" : ""}`}
      onClick={() => onSelect(node.path)}
      type="button"
    >
      {getFileIcon(node.name)}
      <span>{node.name}</span>
    </button>
  );
}

function buildFileTree(files: GeneratedFile[], searchTerm: string): FileTreeNodeType[] {
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const root: FileTreeNodeType[] = [];

  for (const file of files) {
    if (normalizedSearch && !file.path.toLowerCase().includes(normalizedSearch)) {
      continue;
    }

    const parts = file.path.split("/").filter(Boolean);
    let level = root;
    let currentPath = "";

    parts.forEach((part, index) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isFile = index === parts.length - 1;
      let node = level.find((item) => item.name === part && item.type === (isFile ? "file" : "folder"));

      if (!node) {
        node = {
          children: [],
          name: part,
          path: currentPath,
          type: isFile ? "file" : "folder",
        };
        level.push(node);
      }

      level = node.children;
    });
  }

  return sortTree(root);
}

function sortTree(nodes: FileTreeNodeType[]): FileTreeNodeType[] {
  return nodes
    .map((node) => ({ ...node, children: sortTree(node.children) }))
    .sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "folder" ? -1 : 1;
      }

      return a.name.localeCompare(b.name);
    });
}

function formatCodeWithLines(code: string) {
  return code.split("\n").map((content, index) => ({
    content,
    number: index + 1,
  }));
}

function getFileIcon(fileName: string) {
  if (fileName.includes(".")) {
    return <FileCode2 size={15} />;
  }

  return <File size={15} />;
}

function createStarterFiles(): GeneratedFile[] {
  return [
    {
      path: "package.json",
      content: JSON.stringify(
        {
          scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
          dependencies: { react: "^18.2.0", "react-dom": "^18.2.0" },
          devDependencies: { "@vitejs/plugin-react": "^4.3.1", vite: "^5.4.0", tailwindcss: "^3.4.17", autoprefixer: "^10.4.20", postcss: "^8.4.49" },
        },
        null,
        2,
      ),
    },
    { path: "src/App.jsx", content: "export default function App() {\n  return <main className=\"min-h-screen grid place-items-center bg-slate-100 text-slate-950\">Ask Mosaic to generate your app.</main>;\n}\n" },
    { path: "src/main.jsx", content: "import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport './index.css';\nimport App from './App.jsx';\n\ncreateRoot(document.getElementById('root')).render(<App />);\n" },
    { path: "src/index.css", content: "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n" },
    { path: "index.html", content: "<div id=\"root\"></div><script type=\"module\" src=\"/src/main.jsx\"></script>\n" },
    { path: "tailwind.config.js", content: "export default { content: ['./index.html', './src/**/*.{js,jsx}'], theme: { extend: {} }, plugins: [] };\n" },
    { path: "postcss.config.js", content: "export default { plugins: { tailwindcss: {}, autoprefixer: {} } };\n" },
    { path: "README.md", content: "# Mosaic project\n\nRun `npm install` and `npm run dev`.\n" },
  ];
}

function createLoadingGeneration(prompt: string): Generation {
  return {
    title: "Building your React project...",
    summary: "Mosaic is generating React components, Tailwind styles, project files, and the live preview.",
    previewHtml: `<main class="loading-preview">
  <div class="loading-card">
    <div class="loading-mark">M</div>
    <span>Generating React + Tailwind</span>
    <h1>Building your preview</h1>
    <p>${escapeHtml(prompt)}</p>
    <div class="loading-bars"><i></i><i></i><i></i></div>
  </div>
</main>`,
    previewCss: `.loading-preview {
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at top, #eef2ff, #f8fafc 46%, #e8eef5);
  color: #111318;
  font-family: Inter, Arial, sans-serif;
}
.loading-card {
  width: min(460px, calc(100vw - 40px));
  padding: 34px;
  border: 1px solid #dce3ef;
  border-radius: 32px;
  background: rgba(255,255,255,.78);
  box-shadow: 0 30px 90px rgba(31,41,55,.12);
  text-align: center;
}
.loading-mark {
  width: 72px;
  height: 72px;
  margin: 0 auto 18px;
  border-radius: 24px;
  display: grid;
  place-items: center;
  background: #080808;
  color: #fff;
  font-size: 30px;
  font-weight: 900;
}
span { color: #64748b; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: .12em; }
h1 { margin: 10px 0; font-size: clamp(34px, 6vw, 58px); letter-spacing: -.06em; line-height: .95; }
p { margin: 0 auto 22px; max-width: 340px; color: #667085; line-height: 1.55; }
.loading-bars { display: grid; gap: 10px; }
.loading-bars i { display:block; height: 10px; border-radius:999px; background: linear-gradient(90deg,#e2e8f0,#111318,#e2e8f0); background-size: 200% 100%; animation: shimmer 1.1s linear infinite; }
.loading-bars i:nth-child(2) { width: 82%; margin: auto; animation-delay: .15s; }
.loading-bars i:nth-child(3) { width: 64%; margin: auto; animation-delay: .3s; }
@keyframes shimmer { to { background-position: -200% 0; } }`,
    previewJs: "",
    files: createStarterFiles(),
    notes: ["Planning components", "Writing Tailwind classes", "Preparing ZIP files"],
    prompt,
  };
}

function normalizeGeneration(generation: Generation): Generation {
  const files = generation.files?.length ? generation.files : createStarterFiles();

  return {
    ...generation,
    files: ensureProjectFiles(files),
    previewJs: generation.previewJs ?? "",
    notes: generation.notes ?? [],
  };
}

function ensureProjectFiles(files: GeneratedFile[]) {
  const merged = new Map(createStarterFiles().map((file) => [file.path, file]));

  for (const file of files) {
    merged.set(file.path.replace(/^\/+/, ""), file);
  }

  return Array.from(merged.values());
}

function preferFile(files: GeneratedFile[]) {
  return files.find((file) => file.path === "src/App.jsx")?.path ?? files[0]?.path ?? "";
}

function createPreviewDocument(generation: Generation) {
  const preview = normalizePreviewParts(generation);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(generation.title)}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body { min-height: 100%; }
    body { margin: 0; color: #111827; background: #ffffff; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
    ${preview.css.replace(/<\/style/gi, "<\\/style")}
  </style>
</head>
<body>
${preview.html}
<script>
${preview.js.replace(/<\/script/gi, "<\\/script")}
</script>
</body>
</html>`;
}

function normalizePreviewParts(generation: Generation) {
  let html = stripCodeFence(generation.previewHtml ?? "");
  let css = stripCodeFence(generation.previewCss ?? "");
  let js = stripCodeFence(generation.previewJs ?? "");

  if (/<(?:!doctype|html|head|body)\b/i.test(html)) {
    const embeddedStyles = Array.from(html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi))
      .map((match) => match[1])
      .join("\n");
    const embeddedScripts = Array.from(html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi))
      .map((match) => match[1])
      .join("\n");
    const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);

    css = [embeddedStyles, css].filter(Boolean).join("\n");
    js = [embeddedScripts, js].filter(Boolean).join("\n");
    html = body?.[1] ?? html;
  }

  html = html
    .replace(/<!doctype[^>]*>/gi, "")
    .replace(/<\/?(?:html|head|body)[^>]*>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .trim();

  if (!html || /^<div\s+id=["']root["']\s*><\/div>$/i.test(html)) {
    html = createPreviewFallback(generation);
    js = "";
  }

  return { html, css, js };
}

function stripCodeFence(value: string) {
  return value
    .trim()
    .replace(/^```(?:html|css|javascript|js|jsx)?\s*/i, "")
    .replace(/\s*```$/i, "");
}

function createPreviewFallback(generation: Generation) {
  return `<main style="min-height:100vh;display:grid;place-items:center;padding:32px;background:#f8fafc;color:#0f172a">
  <section style="max-width:680px;padding:40px;border:1px solid #e2e8f0;border-radius:28px;background:#fff;box-shadow:0 24px 70px rgba(15,23,42,.10);text-align:center">
    <span style="display:inline-flex;padding:7px 11px;border-radius:999px;background:#eef2ff;color:#4338ca;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase">Mosaic preview</span>
    <h1 style="margin:18px 0 12px;font-size:clamp(34px,6vw,62px);line-height:1;letter-spacing:-.05em">${escapeHtml(generation.title)}</h1>
    <p style="margin:0;color:#64748b;font-size:17px;line-height:1.65">${escapeHtml(generation.summary)}</p>
  </section>
</main>`;
}

function readSessionJson<T>(key: string) {
  const value = window.sessionStorage.getItem(key);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    window.sessionStorage.removeItem(key);
    return null;
  }
}

function createZipBlob(files: GeneratedFile[]) {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.path.replace(/\\/g, "/"));
    const data = encoder.encode(file.content);
    const crc = crc32(data);
    const localHeader = createZipHeader(0x04034b50, name, data.length, crc);
    localParts.push(localHeader, name, data);
    const centralHeader = createCentralDirectoryHeader(name, data.length, crc, offset);
    centralParts.push(centralHeader, name);
    offset += localHeader.length + name.length + data.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = createEndOfCentralDirectory(files.length, centralSize, offset);
  return new Blob([...localParts, ...centralParts, end], { type: "application/zip" });
}

function createZipHeader(signature: number, name: Uint8Array, size: number, crc: number) {
  const header = new Uint8Array(30);
  const view = new DataView(header.buffer);
  view.setUint32(0, signature, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  view.setUint32(14, crc, true);
  view.setUint32(18, size, true);
  view.setUint32(22, size, true);
  view.setUint16(26, name.length, true);
  view.setUint16(28, 0, true);
  return header;
}

function createCentralDirectoryHeader(name: Uint8Array, size: number, crc: number, offset: number) {
  const header = new Uint8Array(46);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  view.setUint16(14, 0, true);
  view.setUint32(16, crc, true);
  view.setUint32(20, size, true);
  view.setUint32(24, size, true);
  view.setUint16(28, name.length, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint16(36, 0, true);
  view.setUint32(38, 0, true);
  view.setUint32(42, offset, true);
  return header;
}

function createEndOfCentralDirectory(fileCount: number, centralSize: number, centralOffset: number) {
  const header = new Uint8Array(22);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, fileCount, true);
  view.setUint16(10, fileCount, true);
  view.setUint32(12, centralSize, true);
  view.setUint32(16, centralOffset, true);
  view.setUint16(20, 0, true);
  return header;
}

function crc32(data: Uint8Array) {
  let crc = -1;

  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }

  return (crc ^ -1) >>> 0;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "mosaic-project";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
