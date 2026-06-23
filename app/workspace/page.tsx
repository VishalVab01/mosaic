"use client";

import type { CSSProperties, PointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUp,
  Bot,
  Camera,
  ChevronDown,
  Check,
  Code2,
  Copy,
  Download,
  Gift,
  HelpCircle,
  History,
  Eye,
  ExternalLink,
  File,
  FileCode2,
  FolderOpen,
  Info,
  Loader2,
  LogOut,
  Monitor,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Star,
  ThumbsDown,
  ThumbsUp,
  UserRound,
  X,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import "./workspace.css";

type GeneratedFile = {
  path: string;
  content: string;
};

type Generation = {
  id?: string;
  title: string;
  summary: string;
  previewHtml: string;
  previewCss: string;
  previewJs?: string;
  files: GeneratedFile[];
  notes?: string[];
  prompt: string;
  generatedAt?: string;
  starred?: boolean;
};

type PendingGeneration = {
  figmaLink?: string;
  prompt: string;
  requestedAt?: string;
};

type GenerationContext = Pick<Generation, "title" | "summary" | "prompt" | "previewHtml" | "previewCss" | "previewJs" | "files">;

type ReferenceImage = {
  data: string;
  mimeType: string;
  name: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type ActivityState = "thinking" | "planning" | "generating" | "editing_file" | "fixing" | "completed";

type ActivityStep = {
  state: ActivityState;
  label: string;
};

type WorkspaceTab = "preview" | "code";
type BuildMode = "build" | "plan";

type PreviewPage = {
  label: string;
  path: string;
};

const MIN_PROMPT_WIDTH = 320;
const DEFAULT_PROMPT_WIDTH = 560;
const MIN_WORKSPACE_WIDTH = 420;
const MAX_PROMPT_WIDTH = 860;
const DEFAULT_CREDIT_LIMIT = 10;
const DEFAULT_GENERATION_UPDATES: ActivityStep[] = [
  { state: "thinking", label: "Analyzing requirements..." },
  { state: "planning", label: "Planning application structure..." },
  { state: "generating", label: "Creating React components..." },
  { state: "editing_file", label: "Editing src/App.jsx..." },
  { state: "editing_file", label: "Generating Tailwind styles..." },
  { state: "fixing", label: "Fixing responsive layout..." },
  { state: "completed", label: "Build complete." },
];

const emptyGeneration: Generation = {
  title: "Start a new Mosaic generation",
  summary: "Describe an app or paste a Figma link to create a React + Tailwind project.",
  previewHtml: `<main class="empty-preview">
  <img class="empty-logo" src="/images/mosaic-loading-animation.gif" alt="Mosaic loading" />
  <p>your preview will be live here<br />ask mosaic to build</p>
</main>`,
  previewCss: `.empty-preview {
  min-height: 100vh;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 20px;
  background: #000;
  color: rgba(255,255,255,.68);
  font-family: Inter, Arial, sans-serif;
  padding: 32px;
  text-align: center;
}
.empty-logo {
  width: min(320px, 52vw);
  height: auto;
  display: block;
}
p { margin: 0; font-size: 16px; font-weight: 400; line-height: 1.45; text-transform: lowercase; }`,
  previewJs: "",
  files: createStarterFiles(),
  notes: ["No generation loaded yet."],
  prompt: "",
};

export default function WorkspacePage() {
  const { data: session } = useSession();
  const [generation, setGeneration] = useState<Generation>(emptyGeneration);
  const [prompt, setPrompt] = useState("");
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("preview");
  const [selectedFilePath, setSelectedFilePath] = useState(emptyGeneration.files[0]?.path ?? "");
  const [fileSearch, setFileSearch] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationUpdateIndex, setGenerationUpdateIndex] = useState(0);
  const [generationUpdates, setGenerationUpdates] = useState(DEFAULT_GENERATION_UPDATES);
  const [promptPaneWidth, setPromptPaneWidth] = useState(DEFAULT_PROMPT_WIDTH);
  const [isResizingWorkspace, setIsResizingWorkspace] = useState(false);
  const [previewFrameKey, setPreviewFrameKey] = useState(0);
  const [buildMode, setBuildMode] = useState<BuildMode>("build");
  const [isBuildMenuOpen, setIsBuildMenuOpen] = useState(false);
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [isPreviewPageMenuOpen, setIsPreviewPageMenuOpen] = useState(false);
  const [activePreviewPath, setActivePreviewPath] = useState("/");
  const [referenceImage, setReferenceImage] = useState<ReferenceImage | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [creditLimit, setCreditLimit] = useState(DEFAULT_CREDIT_LIMIT);
  const activeRequestRef = useRef("");
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const plusMenuRef = useRef<HTMLDivElement>(null);
  const projectMenuRef = useRef<HTMLDivElement>(null);
  const previewPageMenuRef = useRef<HTMLDivElement>(null);
  const workspacePageRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const pending = readSessionJson<PendingGeneration>("mosaic.pendingGeneration");
    const stored = readSessionJson<Generation>("mosaic.latestGeneration");

    if (pending?.prompt) {
      window.sessionStorage.removeItem("mosaic.pendingGeneration");
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
      setPrompt("");
      setChatMessages([
        {
          id: "loaded-prompt",
          role: "user",
          text: stored.prompt || "Continue editing the latest generated project.",
        },
        {
          id: "loaded",
          role: "assistant",
          text: `Loaded your latest React + Tailwind project: ${stored.title}. Ask Mosaic for changes from the composer below.`,
        },
      ]);
    }
  }, []);

  useEffect(() => {
    const handleBuildModeShortcut = (event: KeyboardEvent) => {
      if (event.altKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setBuildMode((mode) => (mode === "build" ? "plan" : "build"));
        setIsBuildMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleBuildModeShortcut);
    return () => window.removeEventListener("keydown", handleBuildModeShortcut);
  }, []);

  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatMessages, generationUpdateIndex, isGenerating]);

  useEffect(() => {
    if (!isGenerating) {
      setGenerationUpdateIndex(0);
      return;
    }

    setGenerationUpdateIndex(0);

    const timer = window.setInterval(() => {
      setGenerationUpdateIndex((index) => Math.min(index + 1, generationUpdates.length - 1));
    }, 2400);

    return () => window.clearInterval(timer);
  }, [generationUpdates.length, isGenerating]);

  useEffect(() => {
    function closeProjectMenu(event: MouseEvent) {
      if (!projectMenuRef.current?.contains(event.target as Node)) {
        setIsProjectMenuOpen(false);
      }

      if (!plusMenuRef.current?.contains(event.target as Node)) {
        setIsPlusMenuOpen(false);
      }

      if (!previewPageMenuRef.current?.contains(event.target as Node)) {
        setIsPreviewPageMenuOpen(false);
      }
    }

    window.addEventListener("mousedown", closeProjectMenu);
    return () => window.removeEventListener("mousedown", closeProjectMenu);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadCredits() {
      const response = await fetch("/api/account");

      if (!isMounted || !response.ok) {
        return;
      }

      const payload = (await response.json().catch(() => null)) as { credits?: number; creditLimit?: number } | null;
      setCredits(typeof payload?.credits === "number" ? payload.credits : null);
      if (typeof payload?.creditLimit === "number") {
        setCreditLimit(payload.creditLimit);
      }
    }

    if (session?.user) {
      void loadCredits();
    }

    return () => {
      isMounted = false;
    };
  }, [session?.user]);

  const previewPages = useMemo(() => buildPreviewPages(generation), [generation]);
  const activePreviewPage = useMemo(
    () => previewPages.find((page) => page.path === activePreviewPath) ?? previewPages[0],
    [activePreviewPath, previewPages],
  );
  const previewDocument = useMemo(() => createPreviewDocument(generation, activePreviewPage), [activePreviewPage, generation]);
  const selectedFile = useMemo(
    () => generation.files.find((file) => file.path === selectedFilePath) ?? generation.files[0],
    [generation.files, selectedFilePath],
  );
  const fileTree = useMemo(() => buildFileTree(generation.files, fileSearch), [generation.files, fileSearch]);
  const workspaceProjectName = generation.title || "Untitled project";
  const creditsRemaining = credits ?? creditLimit;
  const creditsUsed = Math.max(0, creditLimit - creditsRemaining);
  const creditUsagePercent = Math.min(100, Math.round((creditsUsed / creditLimit) * 100));

  useEffect(() => {
    if (!previewPages.some((page) => page.path === activePreviewPath)) {
      setActivePreviewPath(previewPages[0]?.path ?? "/");
    }
  }, [activePreviewPath, previewPages]);

  async function startGeneration(
    nextPrompt: string,
    options: { addUserMessage?: boolean; figmaLink?: string; referenceImage?: ReferenceImage | null; source?: "initial" | "chat" } = {},
  ) {
    const cleanPrompt = nextPrompt.trim();
    const currentGenerationContext = options.source === "chat" ? createGenerationContext(generation) : undefined;

    if (!cleanPrompt) {
      setStatusMessage("Add a prompt before generating.");
      return;
    }

    const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const nextGenerationUpdates = createGenerationUpdates(cleanPrompt, options.referenceImage);
    activeRequestRef.current = requestId;
    setIsGenerating(true);
    setGenerationUpdateIndex(0);
    setGenerationUpdates(nextGenerationUpdates);
    setPrompt("");
    setWorkspaceTab("preview");
    setStatusMessage(currentGenerationContext ? "Mosaic is updating your React + Tailwind project..." : "Mosaic is building your React + Tailwind project...");
    setGeneration(createLoadingGeneration(cleanPrompt));
    setSelectedFilePath("src/App.jsx");
    setActivePreviewPath("/");
    setIsPlusMenuOpen(false);

    setChatMessages((messages) => [
      ...messages.filter((message) => message.id !== "welcome"),
      ...(options.addUserMessage
        ? [
            {
              id: `${requestId}-user`,
              role: "user" as const,
              text: options.referenceImage ? `${cleanPrompt}\n\nReference image: ${options.referenceImage.name}` : cleanPrompt,
            },
          ]
        : []),
    ]);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          figmaLink: options.figmaLink ?? (cleanPrompt.includes("figma.com") ? cleanPrompt : undefined),
          referenceImage: options.referenceImage ?? undefined,
          currentGeneration: currentGenerationContext,
          prompt: cleanPrompt,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        generation?: Omit<Generation, "prompt">;
        generationId?: string;
        creditsRemaining?: number;
        creditLimit?: number;
        error?: string;
      } | null;

      if (!response.ok || !payload?.generation) {
        throw new Error(payload?.error ?? "Could not generate. Please try again.");
      }

      if (activeRequestRef.current !== requestId) {
        return;
      }

      const nextGeneration = normalizeGeneration({
        ...payload.generation,
        id: payload.generationId,
        prompt: cleanPrompt,
        generatedAt: new Date().toISOString(),
      });

      setGeneration(nextGeneration);
      setReferenceImage(null);
      setSelectedFilePath(preferFile(nextGeneration.files));
      setActivePreviewPath(buildPreviewPages(nextGeneration)[0]?.path ?? "/");
      window.sessionStorage.setItem("mosaic.latestGeneration", JSON.stringify(nextGeneration));
      setStatusMessage("Preview updated.");
      setCredits(payload.creditsRemaining ?? credits);
      if (typeof payload.creditLimit === "number") {
        setCreditLimit(payload.creditLimit);
      }
      setIsGenerating(false);
      setChatMessages((messages) => [
        ...messages,
        {
          id: `${requestId}-done`,
          role: "assistant",
          text: `Done - I built "${nextGeneration.title}" as a React + Tailwind project.${
            typeof payload.creditsRemaining === "number" ? ` You have ${payload.creditsRemaining} credits left.` : ""
          } You can preview it, inspect files, or download the ZIP.`,
        },
      ]);
    } catch (error) {
      if (activeRequestRef.current !== requestId) {
        return;
      }

      const message = error instanceof Error ? error.message : "Something went wrong.";
      setGeneration(emptyGeneration);
      setSelectedFilePath(emptyGeneration.files[0]?.path ?? "");
      setActivePreviewPath("/");
      setStatusMessage(message);
      setIsGenerating(false);
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

    void startGeneration(nextPrompt, { addUserMessage: true, referenceImage, source: "chat" });
  }

  async function attachReferenceFile(file: File | undefined) {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setStatusMessage("Attach an image file for design reference.");
      return;
    }

    const nextReferenceImage = await readReferenceImage(file);
    setReferenceImage(nextReferenceImage);
    setIsPlusMenuOpen(false);
    setStatusMessage(`${file.name} attached as a reference image.`);
  }

  async function takeScreenshotReference() {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setStatusMessage("Screen capture is not available in this browser.");
      setIsPlusMenuOpen(false);
      return;
    }

    setIsPlusMenuOpen(false);

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      await video.play();

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1440;
      canvas.height = video.videoHeight || 900;
      const context = canvas.getContext("2d");
      context?.drawImage(video, 0, 0, canvas.width, canvas.height);
      stream.getTracks().forEach((track) => track.stop());

      const dataUrl = canvas.toDataURL("image/png");
      setReferenceImage({
        data: dataUrlToBase64(dataUrl),
        mimeType: "image/png",
        name: `screenshot-${new Date().toISOString().replace(/[:.]/g, "-")}.png`,
      });
      setStatusMessage("Screenshot attached as a reference image.");
    } catch (error) {
      setStatusMessage(error instanceof Error && error.name === "NotAllowedError" ? "Screenshot capture canceled." : "Could not take a screenshot.");
    }
  }

  async function copyCurrentCode() {
    await navigator.clipboard.writeText(selectedFile?.content ?? "");
    setStatusMessage(`${selectedFile?.path ?? "File"} copied to clipboard.`);
  }

  async function copyChatMessage(text: string) {
    await navigator.clipboard.writeText(text);
    setStatusMessage("Message copied.");
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

  function refreshPreview() {
    setPreviewFrameKey((key) => key + 1);
    setStatusMessage("Preview refreshed.");
  }

  function openPreviewInNewTab() {
    const blob = new Blob([previewDocument], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  async function updateStoredGeneration(updates: { title?: string; starred?: boolean }) {
    if (!generation.id) {
      return false;
    }

    const response = await fetch("/api/generations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: generation.id, ...updates }),
    });

    return response.ok;
  }

  async function renameProject() {
    const nextTitle = window.prompt("Rename project", generation.title)?.trim();

    if (!nextTitle) {
      return;
    }

    const nextGeneration = { ...generation, title: nextTitle };
    setGeneration(nextGeneration);
    window.sessionStorage.setItem("mosaic.latestGeneration", JSON.stringify(nextGeneration));
    setIsProjectMenuOpen(false);

    const persisted = await updateStoredGeneration({ title: nextTitle });
    setStatusMessage(persisted || !generation.id ? "Project renamed." : "Project renamed locally.");
  }

  async function toggleStarProject() {
    const starred = !generation.starred;
    const nextGeneration = { ...generation, starred };
    setGeneration(nextGeneration);
    window.sessionStorage.setItem("mosaic.latestGeneration", JSON.stringify(nextGeneration));
    setIsProjectMenuOpen(false);

    const persisted = await updateStoredGeneration({ starred });
    setStatusMessage(
      `${starred ? "Starred" : "Unstarred"} project${persisted || !generation.id ? "." : " locally."}`,
    );
  }

  function clampPromptPaneWidth(nextWidth: number, containerWidth = workspacePageRef.current?.getBoundingClientRect().width ?? window.innerWidth) {
    const maxByContainer = Math.max(MIN_PROMPT_WIDTH, containerWidth - MIN_WORKSPACE_WIDTH);
    return Math.min(Math.max(nextWidth, MIN_PROMPT_WIDTH), Math.min(MAX_PROMPT_WIDTH, maxByContainer));
  }

  function beginWorkspaceResize(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    const container = workspacePageRef.current;

    if (!container) {
      return;
    }

    setIsResizingWorkspace(true);

    const updateWidth = (clientX: number) => {
      const rect = container.getBoundingClientRect();
      setPromptPaneWidth(clampPromptPaneWidth(clientX - rect.left, rect.width));
    };

    const handlePointerMove = (moveEvent: globalThis.PointerEvent) => {
      updateWidth(moveEvent.clientX);
    };

    const stopResize = () => {
      setIsResizingWorkspace(false);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
      window.removeEventListener("pointercancel", stopResize);
    };

    updateWidth(event.clientX);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize);
    window.addEventListener("pointercancel", stopResize);
  }

  function resizeWorkspaceBy(delta: number) {
    const containerWidth = workspacePageRef.current?.getBoundingClientRect().width ?? window.innerWidth;
    setPromptPaneWidth((currentWidth) => clampPromptPaneWidth(currentWidth + delta, containerWidth));
  }

  const workspaceLayoutStyle = {
    "--workspace-prompt-width": `${promptPaneWidth}px`,
  } as CSSProperties;

  return (
    <main
      className={`workspace-page${isResizingWorkspace ? " is-resizing" : ""}`}
      ref={workspacePageRef}
      style={workspaceLayoutStyle}
    >
      <aside className="workspace-sidebar">
        <div className="workspace-sidebar-top">
          <div className="workspace-brand-row">
            <div className="workspace-project-menu-wrap" ref={projectMenuRef}>
              <button
                aria-expanded={isProjectMenuOpen}
                className="workspace-brand"
                onClick={() => setIsProjectMenuOpen((isOpen) => !isOpen)}
                title={workspaceProjectName}
                type="button"
              >
                <span className="brand-mark" aria-hidden="true" />
                <span>{workspaceProjectName}</span>
                <ChevronDown size={14} />
              </button>

              {isProjectMenuOpen && (
                <div className="workspace-project-menu">
                  <div className="workspace-project-menu-head">
                    <span className="brand-mark" aria-hidden="true" />
                    <div>
                      <strong>{workspaceProjectName}</strong>
                      <small>Previewing last saved version</small>
                    </div>
                  </div>

                  <div className="workspace-project-credits">
                    <div>
                      <strong>Usage</strong>
                      <span>{creditUsagePercent}%</span>
                    </div>
                    <div className="workspace-project-credit-bar">
                      <span style={{ width: `${creditUsagePercent}%` }} />
                    </div>
                    <small>
                      {credits === null ? "--" : creditsUsed} / {creditLimit} credits used
                    </small>
                  </div>

                  <button type="button" onClick={() => setStatusMessage("Free credits are coming soon.")}>
                    <Gift size={16} />
                    <span>Get free credits</span>
                  </button>
                  <button type="button" onClick={renameProject}>
                    <Pencil size={16} />
                    <span>Rename project</span>
                  </button>
                  <button type="button" onClick={toggleStarProject}>
                    <Star size={16} />
                    <span>{generation.starred ? "Unstar project" : "Star project"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusMessage(`${workspaceProjectName}: ${generation.files.length} files generated.`);
                      setIsProjectMenuOpen(false);
                    }}
                  >
                    <Info size={16} />
                    <span>Details</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusMessage("Help is coming soon.");
                      setIsProjectMenuOpen(false);
                    }}
                  >
                    <HelpCircle size={16} />
                    <span>Help</span>
                  </button>
                </div>
              )}
            </div>
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
            {chatMessages.map((message) => (
              <div className={`workspace-message ${message.role}`} key={message.id}>
                <span className="workspace-message-avatar" aria-hidden="true">
                  {message.role === "assistant" ? <Bot size={15} /> : <UserRound size={15} />}
                </span>
                <div className="workspace-message-content">
                  <p>
                    <TypewriterText animate={message.role === "assistant"} text={message.text} />
                  </p>
                  <MessageActions
                    messageRole={message.role}
                    onCopy={() => void copyChatMessage(message.text)}
                    onSecondaryAction={(label) => setStatusMessage(`${label} noted.`)}
                  />
                </div>
              </div>
            ))}
            {isGenerating && (
              <div className="workspace-message assistant">
                <span className="workspace-message-avatar" aria-hidden="true">
                  <Loader2 className="workspace-spin" size={15} />
                </span>
                <div className="workspace-message-content">
                  <ActivityTimeline activeIndex={generationUpdateIndex} steps={generationUpdates} />
                  <MessageActions
                    messageRole="assistant"
                    onCopy={() => void copyChatMessage(generationUpdates[generationUpdateIndex]?.label ?? "Mosaic is working.")}
                    onSecondaryAction={(label) => setStatusMessage(`${label} noted.`)}
                  />
                </div>
              </div>
            )}
            <div ref={chatMessagesEndRef} />
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

            {referenceImage && (
              <div className="workspace-reference-chip">
                <Paperclip size={14} />
                <span>{referenceImage.name}</span>
                <button aria-label="Remove reference image" onClick={() => setReferenceImage(null)} title="Remove reference image" type="button">
                  <X size={13} />
                </button>
              </div>
            )}

            <div className="workspace-composer-actions">
              <div className="workspace-plus-wrapper" ref={plusMenuRef}>
                <input
                  ref={fileInputRef}
                  accept="image/*"
                  hidden
                  onChange={(event) => {
                    void attachReferenceFile(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                  type="file"
                />
                {isPlusMenuOpen && (
                  <div className="workspace-plus-menu" role="menu">
                    <button
                      onClick={() => {
                        fileInputRef.current?.click();
                      }}
                      role="menuitem"
                      type="button"
                    >
                      <Paperclip size={16} />
                      <span>Attach</span>
                    </button>
                    <button
                      onClick={() => {
                        setStatusMessage("History is available from Recent generations on the generate page.");
                        setIsPlusMenuOpen(false);
                      }}
                      role="menuitem"
                      type="button"
                    >
                      <History size={16} />
                      <span>History</span>
                    </button>
                    <button onClick={() => void takeScreenshotReference()} role="menuitem" type="button">
                      <Camera size={16} />
                      <span>Take a screenshot</span>
                    </button>
                  </div>
                )}
                <button
                  aria-expanded={isPlusMenuOpen}
                  className="workspace-plus-button"
                  onClick={() => setIsPlusMenuOpen((isOpen) => !isOpen)}
                  type="button"
                  aria-label="Open composer options"
                >
                  <Plus size={20} />
                </button>
              </div>

              <div className="workspace-composer-right">
                <div className="workspace-build-wrapper">
                  {isBuildMenuOpen && (
                    <div className="workspace-build-options" role="menu">
                      <button
                        className="workspace-build-option"
                        onClick={() => {
                          setBuildMode("build");
                          setIsBuildMenuOpen(false);
                        }}
                        role="menuitemradio"
                        aria-checked={buildMode === "build"}
                        type="button"
                      >
                        <span className="workspace-build-check">{buildMode === "build" ? <Check size={15} /> : null}</span>
                        <span>
                          <span className="workspace-build-option-title">Build</span>
                          <small>Make changes directly</small>
                        </span>
                      </button>
                      <button
                        className="workspace-build-option"
                        onClick={() => {
                          setBuildMode("plan");
                          setIsBuildMenuOpen(false);
                        }}
                        role="menuitemradio"
                        aria-checked={buildMode === "plan"}
                        type="button"
                      >
                        <span className="workspace-build-check">{buildMode === "plan" ? <Check size={15} /> : null}</span>
                        <span>
                          <span className="workspace-build-option-title">Plan</span>
                          <small>Discuss before building</small>
                        </span>
                      </button>
                      <div className="workspace-build-shortcut">
                        Toggle with <kbd>Alt</kbd> <kbd>P</kbd>
                      </div>
                    </div>
                  )}
                  <button
                    aria-expanded={isBuildMenuOpen}
                    className="workspace-build-menu"
                    onClick={() => setIsBuildMenuOpen((isOpen) => !isOpen)}
                    type="button"
                  >
                    {buildMode === "build" ? "Build" : "Plan"}
                    <ChevronDown size={15} />
                  </button>
                </div>
                <button className="workspace-send-button" onClick={submitPrompt} disabled={isGenerating} type="button" aria-label="Send prompt">
                  {isGenerating ? <Loader2 className="workspace-spin" size={18} /> : <ArrowUp size={20} />}
                </button>
              </div>
            </div>
          </div>

          {statusMessage && <p className="workspace-status">{statusMessage}</p>}
        </section>
      </aside>

      <button
        aria-label="Resize prompt and preview panes"
        aria-valuemax={MAX_PROMPT_WIDTH}
        aria-valuemin={MIN_PROMPT_WIDTH}
        aria-valuenow={Math.round(promptPaneWidth)}
        className="workspace-resize-handle"
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            resizeWorkspaceBy(event.shiftKey ? -48 : -16);
          }

          if (event.key === "ArrowRight") {
            event.preventDefault();
            resizeWorkspaceBy(event.shiftKey ? 48 : 16);
          }
        }}
        onPointerDown={beginWorkspaceResize}
        role="separator"
        title="Resize workspace panes"
        type="button"
      />

      <section className="workspace-stage">
        <header className="workspace-topbar">
          <div className="workspace-mode-tabs" aria-label="Workspace view">
            <button
              aria-label="Preview"
              className={workspaceTab === "preview" ? "active" : ""}
              onClick={() => setWorkspaceTab("preview")}
              title="Preview"
              type="button"
            >
              <Eye size={16} />
            </button>
            <button
              aria-label="Code"
              className={workspaceTab === "code" ? "active" : ""}
              onClick={() => setWorkspaceTab("code")}
              title="Code"
              type="button"
            >
              <Code2 size={16} />
            </button>
          </div>

          <div className="workspace-topbar-actions">
            <button aria-label="Desktop preview" className="workspace-preview-icon-button" title="Desktop preview" type="button">
              <Monitor size={16} />
            </button>

            <div className="workspace-preview-address" aria-label="Preview page" ref={previewPageMenuRef}>
              <button aria-label="Refresh preview" className="workspace-preview-refresh" onClick={refreshPreview} title="Refresh preview" type="button">
                <RefreshCw size={15} />
              </button>
              <button
                aria-expanded={isPreviewPageMenuOpen}
                className="workspace-preview-page"
                onClick={() => setIsPreviewPageMenuOpen((isOpen) => !isOpen)}
                type="button"
              >
                <span>{activePreviewPage?.label ?? "Home"}</span>
                <ChevronDown size={15} />
              </button>
              {isPreviewPageMenuOpen && (
                <div className="workspace-preview-page-menu">
                  {previewPages.map((page) => (
                    <button
                      className={page.path === activePreviewPage?.path ? "active" : ""}
                      key={page.path}
                      onClick={() => {
                        setActivePreviewPath(page.path);
                        setIsPreviewPageMenuOpen(false);
                        setWorkspaceTab("preview");
                        setPreviewFrameKey((key) => key + 1);
                        setStatusMessage(`Previewing ${page.label}.`);
                      }}
                      type="button"
                    >
                      <span>{page.label}</span>
                      <small>{page.path}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button aria-label="Open preview in new tab" className="workspace-preview-icon-button" onClick={openPreviewInNewTab} title="Open preview in new tab" type="button">
              <ExternalLink size={16} />
            </button>
          </div>

          <button aria-label="Download ZIP" className="workspace-download-button" onClick={downloadZip} title="Download ZIP" type="button">
            <Download size={16} />
          </button>
        </header>

        <div className="workspace-canvas">
          {workspaceTab === "preview" ? (
            <iframe key={previewFrameKey} title={`${generation.title} preview`} sandbox="allow-scripts" srcDoc={previewDocument} />
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
                    <button
                      aria-label="Download ZIP"
                      className="workspace-copy-button workspace-icon-only"
                      onClick={downloadZip}
                      title="Download ZIP"
                      type="button"
                    >
                      <Download size={15} />
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

function ActivityTimeline({ activeIndex, steps }: { activeIndex: number; steps: ActivityStep[] }) {
  const visibleSteps = steps.slice(0, Math.min(steps.length, activeIndex + 1));

  return (
    <div className="workspace-activity-timeline" aria-live="polite">
      <div className="workspace-activity-header">
        <span>Mosaic activity</span>
        <small>{steps[activeIndex]?.state.replace("_", " ") ?? "thinking"}</small>
      </div>

      <div className="workspace-activity-list">
        {visibleSteps.map((step, index) => {
          const isActive = index === activeIndex;
          const isComplete = index < activeIndex || step.state === "completed";

          return (
            <div className={`workspace-activity-row${isActive ? " active" : ""}${isComplete ? " complete" : ""}`} key={`${step.state}-${step.label}`}>
              <span className="workspace-activity-status" aria-hidden="true">
                {isComplete ? <Check size={13} /> : <i />}
              </span>
              <span className="workspace-activity-copy">
                <span className="workspace-activity-label">{step.label}</span>
                <small>{step.state.replace("_", " ")}</small>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MessageActions({
  messageRole,
  onCopy,
  onSecondaryAction,
}: {
  messageRole: ChatMessage["role"];
  onCopy: () => void;
  onSecondaryAction: (label: string) => void;
}) {
  if (messageRole === "user") {
    return (
      <div className="workspace-message-actions compact">
        <button aria-label="Copy message" className="workspace-message-action" onClick={onCopy} title="Copy message" type="button">
          <Copy size={13} />
        </button>
      </div>
    );
  }

  return (
    <div className="workspace-message-actions">
      <button aria-label="Regenerate" className="workspace-message-action" onClick={() => onSecondaryAction("Regenerate")} title="Regenerate" type="button">
        <RotateCcw size={13} />
      </button>
      <button aria-label="Good response" className="workspace-message-action" onClick={() => onSecondaryAction("Good response")} title="Good response" type="button">
        <ThumbsUp size={13} />
      </button>
      <button aria-label="Bad response" className="workspace-message-action" onClick={() => onSecondaryAction("Bad response")} title="Bad response" type="button">
        <ThumbsDown size={13} />
      </button>
      <button aria-label="Copy message" className="workspace-message-action" onClick={onCopy} title="Copy message" type="button">
        <Copy size={13} />
      </button>
    </div>
  );
}

function TypewriterText({ animate = true, text }: { animate?: boolean; text: string }) {
  const [visibleText, setVisibleText] = useState(animate ? "" : text);

  useEffect(() => {
    if (!animate) {
      setVisibleText(text);
      return;
    }

    setVisibleText("");

    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setVisibleText(text.slice(0, index));

      if (index >= text.length) {
        window.clearInterval(timer);
      }
    }, 18);

    return () => window.clearInterval(timer);
  }, [animate, text]);

  return <>{visibleText}</>;
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
  <img src="/images/mosaic-loading-animation.gif" alt="Mosaic loading" />
  <p>your preview will be live here<br />ask mosaic to build</p>
</main>`,
    previewCss: `.loading-preview {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 20px;
  background: #000;
  color: rgba(255,255,255,.52);
  font-family: Inter, Arial, sans-serif;
  padding: 32px;
  text-align: center;
}
.loading-preview img {
  width: min(320px, 52vw);
  height: auto;
  display: block;
}
.loading-preview p {
  margin: 0;
  max-width: 520px;
  font-size: 16px;
  font-weight: 400;
  line-height: 1.45;
  text-transform: lowercase;
}`,
    previewJs: "",
    files: createStarterFiles(),
    notes: ["Planning components", "Writing Tailwind classes", "Preparing ZIP files"],
    prompt,
  };
}

function createGenerationUpdates(prompt: string, referenceImage?: ReferenceImage | null) {
  const lowerPrompt = prompt.toLowerCase();
  const subject = summarizePromptSubject(prompt);
  const updates: ActivityStep[] = [
    { state: "thinking", label: `Analyzing requirements for ${subject}...` },
    ...(referenceImage
      ? [{ state: "thinking" as const, label: `Studying ${referenceImage.name} for layout, spacing, colors, and visual details...` }]
      : []),
  ];

  if (matchesPrompt(lowerPrompt, ["clone", "copy", "replica", "same as", "reference", "figma"])) {
    updates.push(
      { state: "planning", label: "Mapping the reference into reusable React sections..." },
      { state: "planning", label: "Matching the strongest visual cues before writing the preview..." },
    );
  } else if (matchesPrompt(lowerPrompt, ["dashboard", "admin", "analytics", "crm", "saas", "chart", "table"])) {
    updates.push(
      { state: "planning", label: "Planning dashboard hierarchy, metrics, tables, and control states..." },
      { state: "fixing", label: "Balancing dense data areas with clear scanning patterns..." },
    );
  } else if (matchesPrompt(lowerPrompt, ["landing", "homepage", "marketing", "hero", "startup", "agency"])) {
    updates.push(
      { state: "planning", label: "Structuring the hero, conversion sections, and supporting proof points..." },
      { state: "fixing", label: "Tuning the page rhythm so the first screen feels polished..." },
    );
  } else if (matchesPrompt(lowerPrompt, ["login", "signup", "sign up", "auth", "onboarding"])) {
    updates.push(
      { state: "planning", label: "Designing the form flow, input states, and account actions..." },
      { state: "fixing", label: "Checking the layout for mobile-friendly authentication patterns..." },
    );
  } else if (matchesPrompt(lowerPrompt, ["shop", "store", "ecommerce", "product", "cart", "checkout"])) {
    updates.push(
      { state: "planning", label: "Arranging product cards, filters, pricing, and purchase actions..." },
      { state: "fixing", label: "Making the commerce flow feel clear and ready to browse..." },
    );
  } else if (matchesPrompt(lowerPrompt, ["portfolio", "resume", "personal", "creator", "photographer"])) {
    updates.push(
      { state: "planning", label: "Shaping portfolio sections around work, identity, and contact paths..." },
      { state: "fixing", label: "Giving the presentation enough polish without drowning the content..." },
    );
  } else if (matchesPrompt(lowerPrompt, ["mobile", "app", "ios", "android"])) {
    updates.push(
      { state: "planning", label: "Prioritizing compact mobile surfaces and thumb-friendly controls..." },
      { state: "fixing", label: "Checking spacing and component scale for smaller screens..." },
    );
  } else {
    updates.push(
      { state: "planning", label: "Planning the main screens, components, and interaction states..." },
      { state: "planning", label: "Choosing a visual system that fits the product idea..." },
    );
  }

  updates.push(
    { state: "generating", label: "Creating React components..." },
    { state: "editing_file", label: "Editing src/App.jsx..." },
    { state: "editing_file", label: "Editing src/components/Navbar.jsx..." },
    { state: "editing_file", label: "Generating Tailwind styles..." },
    { state: "fixing", label: "Fixing responsive layout..." },
    { state: "fixing", label: `Polishing ${subject} before the preview updates...` },
    { state: "completed", label: "Build complete." },
  );

  return updates;
}

function matchesPrompt(prompt: string, terms: string[]) {
  return terms.some((term) => prompt.includes(term));
}

function summarizePromptSubject(prompt: string) {
  const cleanPrompt = prompt
    .replace(/\s+/g, " ")
    .replace(/https?:\/\/\S+/gi, "reference link")
    .trim();

  if (!cleanPrompt) {
    return "your project";
  }

  const words = cleanPrompt.split(" ").slice(0, 8).join(" ");
  return words.length < cleanPrompt.length ? `${words}...` : words;
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

function createGenerationContext(generation: Generation): GenerationContext | undefined {
  if (!generation.prompt || generation.title === emptyGeneration.title) {
    return undefined;
  }

  return {
    title: generation.title,
    summary: generation.summary,
    prompt: generation.prompt,
    previewHtml: generation.previewHtml,
    previewCss: generation.previewCss,
    previewJs: generation.previewJs,
    files: generation.files,
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

function createPreviewDocument(generation: Generation, activePage?: PreviewPage) {
  const preview = normalizePreviewParts(generation);
  const activePath = activePage?.path ?? "/";

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
${createPreviewNavigationScript(activePath)}
${preview.js.replace(/<\/script/gi, "<\\/script")}
</script>
</body>
</html>`;
}

function buildPreviewPages(generation: Generation): PreviewPage[] {
  const preview = normalizePreviewParts(generation);
  const pages = new Map<string, PreviewPage>();

  addPreviewPage(pages, { label: "Home", path: "/" });

  for (const match of preview.html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const path = normalizePreviewPath(match[1]);

    if (!path) {
      continue;
    }

    addPreviewPage(pages, {
      label: cleanPreviewLabel(match[2]) || labelFromPath(path),
      path,
    });
  }

  for (const file of generation.files) {
    const normalizedPath = file.path.replace(/\\/g, "/");
    const pageMatch = normalizedPath.match(/^src\/pages\/(.+?)\.(?:jsx|tsx|js|ts)$/i);
    const appRouteMatch = normalizedPath.match(/^app\/(.+?)\/page\.(?:jsx|tsx|js|ts)$/i);
    const routePath = pageMatch?.[1] ?? appRouteMatch?.[1];

    if (!routePath || /^index$/i.test(routePath)) {
      continue;
    }

    const path = `/${routePath.replace(/\/index$/i, "").replace(/\[(.+?)\]/g, ":$1")}`;
    addPreviewPage(pages, { label: labelFromPath(path), path });
  }

  return Array.from(pages.values());
}

function addPreviewPage(pages: Map<string, PreviewPage>, page: PreviewPage) {
  const path = normalizePreviewPath(page.path);

  if (!path || pages.has(path)) {
    return;
  }

  pages.set(path, { label: page.label || labelFromPath(path), path });
}

function normalizePreviewPath(value: string) {
  const cleanValue = value.trim();

  if (!cleanValue || /^(?:https?:|mailto:|tel:|javascript:)/i.test(cleanValue)) {
    return "";
  }

  if (cleanValue === "#") {
    return "/";
  }

  if (cleanValue.startsWith("#")) {
    return cleanValue;
  }

  if (cleanValue.startsWith("/")) {
    return cleanValue.replace(/[?#].*$/, "") || "/";
  }

  return "";
}

function cleanPreviewLabel(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
}

function labelFromPath(path: string) {
  if (path === "/" || path === "#home" || path === "#homepage") {
    return "Home";
  }

  const segment = path.replace(/^#?\/?/, "").split("/").filter(Boolean).at(-1) ?? "Page";

  return segment
    .replace(/^:/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function createPreviewNavigationScript(activePath: string) {
  return `
(function () {
  var activePath = ${JSON.stringify(activePath)};

  function normalizePath(path) {
    if (!path || path === "#") return "/";
    if (path.charAt(0) === "#") return path;
    if (path.charAt(0) === "/") return path.replace(/[?#].*$/, "") || "/";
    return "";
  }

  function activate() {
    if (activePath.charAt(0) === "#") {
      var target = document.querySelector(activePath);
      if (target && typeof target.scrollIntoView === "function") {
        target.scrollIntoView({ block: "start" });
      }
      window.location.hash = activePath.slice(1);
    }

    document.querySelectorAll("a[href]").forEach(function (link) {
      var linkPath = normalizePath(link.getAttribute("href") || "");
      var isActive = linkPath === activePath || (activePath === "/" && (linkPath === "/" || linkPath === "#home" || linkPath === "#homepage"));
      link.toggleAttribute("aria-current", isActive);
      if (isActive) {
        link.classList.add("active", "is-active");
      } else {
        link.classList.remove("active", "is-active");
      }
    });

    window.dispatchEvent(new PopStateEvent("popstate"));
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", activate, { once: true });
  } else {
    activate();
  }
})();`;
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

function readReferenceImage(file: File): Promise<ReferenceImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      resolve({
        data: dataUrlToBase64(dataUrl),
        mimeType: file.type || "image/png",
        name: file.name,
      });
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read image."));
    reader.readAsDataURL(file);
  });
}

function dataUrlToBase64(dataUrl: string) {
  return dataUrl.includes(",") ? dataUrl.split(",")[1] ?? "" : dataUrl;
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
