"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Sacramento } from "next/font/google";
import ExitToAppRoundedIcon from "@mui/icons-material/ExitToAppRounded";
import {
  CheckCircle2,
  Clapperboard,
  CreditCard,
  LogOut,
  Menu,
  Paperclip,
  Plug,
  Plus,
  Settings,
  UserRound,
  X,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import "./generate.css";

type RecentGeneration = {
  id: string;
  title: string;
  summary: string;
  previewHtml: string;
  previewCss: string;
  previewJs?: string;
  files: Array<{ path: string; content: string }>;
  notes?: string[];
  prompt: string;
  generatedAt?: string;
};

export default function GeneratePage() {
  return (
    <Suspense fallback={null}>
      <GenerateExperience />
    </Suspense>
  );
}
const prompts = [
  "Ask MOSAIC to build a modern SaaS dashboard...",
  "Ask MOSAIC to create a portfolio website for a developer...",
  "Ask MOSAIC to design a food delivery app with live tracking...",
  "Ask MOSAIC to generate an e-commerce store for a fashion brand...",
];
const DEFAULT_CREDIT_LIMIT = 10;
const sacramento = Sacramento({
  subsets: ["latin"],
  weight: "400",
});

function GenerateExperience() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [figmaLink, setFigmaLink] = useState("");
  const [fileName, setFileName] = useState("");
  const [filePreview, setFilePreview] = useState("");
  const [generationError, setGenerationError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFigmaImportMode, setIsFigmaImportMode] = useState(false);
  const suggestions = [
    "SaaS dashboard with charts",
    "Responsive landing page",
    "AI chat interface",
    "Pricing page with cards",
    "Mobile app onboarding flow",
  ];


const [placeholder, setPlaceholder] = useState("");
const [promptIndex, setPromptIndex] = useState(0);
  
  const [imageFailed, setImageFailed] = useState(false);
  const [recentGenerations, setRecentGenerations] = useState<RecentGeneration[]>([]);
  const [credits, setCredits] = useState<number | null>(null);
  const [creditLimit, setCreditLimit] = useState(DEFAULT_CREDIT_LIMIT);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptInputRef = useRef<HTMLTextAreaElement>(null);
  const userInitial = session?.user?.name?.trim().charAt(0).toUpperCase() || session?.user?.email?.charAt(0).toUpperCase() || "M";
  const userImage = imageFailed ? null : session?.user?.image;
  const pendingGenerationKey = getUserStorageKey("pendingGeneration", session?.user);
  const latestGenerationKey = getUserStorageKey("latestGeneration", session?.user);
  const creditsRemaining = credits ?? creditLimit;
  const creditsUsed = Math.max(0, creditLimit - creditsRemaining);
  const usagePercent = Math.min(100, Math.round((creditsUsed / creditLimit) * 100));

  useEffect(() => {
  if (figmaLink || isFigmaImportMode) return;

  const text = prompts[promptIndex];
  let i = 0;

  const typing = setInterval(() => {
    setPlaceholder(text.slice(0, i + 1));
    i++;

    if (i === text.length) {
      clearInterval(typing);

      setTimeout(() => {
        setPromptIndex((prev) => (prev + 1) % prompts.length);
        setPlaceholder("");
      }, 2000);
    }
  }, 45);

  return () => clearInterval(typing);
}, [promptIndex, figmaLink, isFigmaImportMode]);

  useEffect(() => {
    const authStatus = searchParams.get("auth");

    if (authStatus !== "login" && authStatus !== "signup") {
      return;
    }

    setSuccessMessage(authStatus === "signup" ? "Account created successfully." : "Logged in successfully.");
    router.replace("/generate", { scroll: false });
  }, [router, searchParams]);

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    const timer = window.setTimeout(() => setSuccessMessage(""), 4200);
    return () => window.clearTimeout(timer);
  }, [successMessage]);

  useEffect(() => {
    return () => {
      if (filePreview) {
        URL.revokeObjectURL(filePreview);
      }
    };
  }, [filePreview]);

  useEffect(() => {
    let isMounted = true;

    async function loadAccountData() {
      const [accountResponse, generationsResponse] = await Promise.all([
        fetch("/api/account"),
        fetch("/api/generations"),
      ]);

      if (!isMounted) {
        return;
      }

      if (accountResponse.ok) {
        const accountPayload = (await accountResponse.json().catch(() => null)) as { credits?: number; creditLimit?: number } | null;
        setCredits(typeof accountPayload?.credits === "number" ? accountPayload.credits : null);
        if (typeof accountPayload?.creditLimit === "number") {
          setCreditLimit(accountPayload.creditLimit);
        }
      }

      if (generationsResponse.ok) {
        const generationsPayload = (await generationsResponse.json().catch(() => null)) as {
          generations?: RecentGeneration[];
        } | null;
        setRecentGenerations(generationsPayload?.generations ?? []);
      }
    }

    if (session?.user) {
      void loadAccountData();
    }

    return () => {
      isMounted = false;
    };
  }, [session?.user]);

  function handleGenerate() {
    const prompt = figmaLink.trim();
    const isFigmaLink = /https?:\/\/([a-z0-9-]+\.)?figma\.com\//i.test(prompt);

    if (!prompt) {
      setGenerationError(isFigmaImportMode ? "Paste your Figma link first." : "Describe what you want to build first.");
      return;
    }

    if (isFigmaImportMode && !isFigmaLink) {
      setGenerationError("Paste a valid Figma link to import the design.");
      return;
    }

    if (credits === 0) {
      setGenerationError("You are out of credits. Buy a plan to keep generating.");
      return;
    }

    setGenerationError("");
    const generationPrompt = isFigmaLink
      ? `Convert this Figma design into a production-ready React website: ${prompt}`
      : prompt;

    window.sessionStorage.setItem(
      pendingGenerationKey,
      JSON.stringify({
        figmaLink: isFigmaLink ? prompt : undefined,
        prompt: generationPrompt,
        requestedAt: new Date().toISOString(),
      }),
    );
    window.sessionStorage.removeItem("mosaic.pendingGeneration");
    router.push("/workspace");
  }

  function enableFigmaImport() {
    setIsFigmaImportMode(true);
    setFigmaLink("");
    setGenerationError("");
    setPlaceholder("Paste your Figma link here");
    requestAnimationFrame(() => promptInputRef.current?.focus());
  }

  function handleReferenceFile(file: File | undefined) {
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
    }

    if (!file) {
      setFileName("");
      setFilePreview("");
      return;
    }

    setFileName(file.name);
    setFilePreview(URL.createObjectURL(file));
  }

  function removeReferenceFile() {
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
    }

    setFileName("");
    setFilePreview("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function openRecentGeneration(generation: RecentGeneration) {
    window.sessionStorage.removeItem(pendingGenerationKey);
    window.sessionStorage.removeItem("mosaic.pendingGeneration");
    window.sessionStorage.setItem(latestGenerationKey, JSON.stringify(generation));
    window.sessionStorage.removeItem("mosaic.latestGeneration");
    router.push("/workspace");
  }

  function showComingSoon(label: string) {
    setSuccessMessage(`${label} settings are coming soon.`);
  }

  return (
    <main className={`generate-page${isSidebarOpen ? " sidebar-open" : ""}`}>
      <aside className="generate-sidebar" aria-label="Generate navigation">
        <button
          aria-expanded={isSidebarOpen}
          aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
          className="generate-sidebar-button generate-menu-button"
          onClick={() => {
            setIsSidebarOpen((value) => !value);
            setIsSettingsOpen(false);
          }}
          type="button"
        >
          {isSidebarOpen ? <X size={22} /> : <Menu size={24} />}
          <span>Menu</span>
        </button>

        {isSidebarOpen && (
          <>
            <Link className="generate-sidebar-link generate-new-link" href="/generate">
              <Plus size={19} />
              <span>New generation</span>
            </Link>

            <div className="generate-credits">
              <div className="generate-credits-header">
                <span>Usage</span>
                <strong>{usagePercent}%</strong>
              </div>
              <div className="generate-usage-bar" aria-label={`${usagePercent}% credits used`}>
                <i style={{ width: `${usagePercent}%` }} />
              </div>
              <small>
                {credits === null ? "--" : creditsUsed} / {creditLimit} credits used
              </small>
            </div>

            <div className="generate-recents">
              <p>Recent generations</p>
              {recentGenerations.length === 0 && <small>No generations yet</small>}
              {recentGenerations.map((generation) => (
                <button
                  key={generation.id}
                  type="button"
                  onClick={() => openRecentGeneration(generation)}
                  title={generation.prompt}
                >
                  <Clapperboard size={17} />
                  <span>{generation.title}</span>
                </button>
              ))}
            </div>
          </>
        )}

        <div className="generate-sidebar-bottom">
          <div className="generate-settings">
            {isSidebarOpen && isSettingsOpen && (
              <div className="generate-settings-menu">
                <p>Settings</p>
                <Link href="/profile">
                  <UserRound size={17} />
                  <span>Profile</span>
                </Link>
                <button type="button" onClick={() => showComingSoon("Payments")}>
                  <CreditCard size={17} />
                  <span>Payments</span>
                </button>
                <button type="button" onClick={() => showComingSoon("Integrations")}>
                  <Plug size={17} />
                  <span>Integrations</span>
                </button>
                <button type="button" onClick={() => showComingSoon("Account")}>
                  <Settings size={17} />
                  <span>Account settings</span>
                </button>
              </div>
            )}

            <button
              aria-expanded={isSettingsOpen}
              aria-label="Settings"
              className="generate-sidebar-button generate-settings-button"
              onClick={() => {
                if (!isSidebarOpen) {
                  setIsSidebarOpen(true);
                  setIsSettingsOpen(true);
                  return;
                }

                setIsSettingsOpen((value) => !value);
              }}
              type="button"
            >
              <Settings size={21} />
              <span>Settings</span>
            </button>
          </div>

          <button
            aria-label="Log out"
            className="generate-account-button"
            onClick={() => signOut({ callbackUrl: "/" })}
            type="button"
          >
            <span className="generate-avatar">
              {userImage ? (
                <img
                  alt={session?.user?.name || "Account"}
                  onError={() => setImageFailed(true)}
                  referrerPolicy="no-referrer"
                  src={userImage}
                />
              ) : (
                userInitial
              )}
            </span>
            <span className="generate-account-copy">
              <strong>{session?.user?.name || "Account"}</strong>
              <small>Log out</small>
            </span>
            {isSidebarOpen && <LogOut size={17} />}
          </button>
        </div>
      </aside>

      {successMessage && (
        <div className="generate-success-toast" key={successMessage} role="status" aria-live="polite">
          <CheckCircle2 size={18} />
          <span>{successMessage}</span>
        </div>
      )}

      <section className="generate-hero">
        <div className="generate-copy">
          <h1>
            Turn your <FigmaWordmark className={sacramento.className} /> designs into production-ready code.
          </h1>
          <p>
            Paste your Figma link, optionally attach reference images, and generate your application instantly.
          </p>
        </div>

      <div className="generate-composer">
        <div className="generate-textarea-wrapper">
          {!figmaLink && (
            <div className="animated-placeholder">
              {placeholder}
              <span className="caret" />
            </div>
          )}

          <textarea
            aria-label="Figma file URL"
            ref={promptInputRef}
            rows={2}
            value={figmaLink}
            onChange={(e) => setFigmaLink(e.target.value)}
          />
        </div>

        <div className="generate-toolbar">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => handleReferenceFile(event.target.files?.[0])}
          />

          <div className="generate-toolbar-left">
            <button
              aria-label={
                fileName
                  ? `Attached ${fileName}`
                  : "Attach reference image"
              }
              className="generate-attach-button"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Attach reference image"
            >
              <Paperclip size={22} />
            </button>

            <button
              aria-pressed={isFigmaImportMode}
              className="generate-figma-button"
              type="button"
              onClick={enableFigmaImport}
              title="Import Figma link"
            >
              <span className="generate-figma-logo" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
                <span />
              </span>
              <span>Import Figma</span>
            </button>
          </div>

        <button
          className="generate-run-button"
          onClick={handleGenerate}
          type="button"
        >
          <ExitToAppRoundedIcon fontSize="small" />
        </button>
        </div>

        {filePreview && (
          <div className="generate-reference-chip">
            <img alt="" aria-hidden="true" src={filePreview} />
            <span>{fileName}</span>
            <button aria-label="Remove reference image" onClick={removeReferenceFile} title="Remove reference image" type="button">
              <X size={13} />
            </button>
          </div>
        )}

        {generationError && (
          <p className="generate-error-message">
            {generationError}
          </p>
        )}
      </div>

      <div className="generate-suggestions">
        <p className="generate-suggestions-title">
          Not sure where to start? Try these
        </p>

        <div className="generate-suggestions-grid">
          {suggestions.map((item) => (
            <button
              key={item}
              type="button"
              className="generate-suggestion-chip"
              onClick={() => {
                setIsFigmaImportMode(false);
                setFigmaLink(item);
              }}
            >
              <span className="generate-chip-dot" />
              {item}
            </button>
          ))}
        </div>
      </div>
      </section>
    </main>
  );
}

function FigmaWordmark({ className }: { className: string }) {
  return (
    <svg
      aria-label="Figma"
      className="figma-handwriting-logo"
      role="img"
      viewBox="0 0 320 118"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="figma-word-gradient" x1="18" x2="302" y1="18" y2="96" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9460EA" />
          <stop offset="1" stopColor="#68B5F3" />
        </linearGradient>
      </defs>
      <text className={`figma-handwriting-stroke ${className}`} x="14" y="84">
        Figma
      </text>
      <text className={`figma-handwriting-fill ${className}`} x="14" y="84">
        Figma
      </text>
    </svg>
  );
}

function getUserStorageKey(kind: "pendingGeneration" | "latestGeneration", user?: { id?: string | null; email?: string | null }) {
  const owner = user?.id || user?.email?.toLowerCase() || "anonymous";
  return `mosaic.${owner}.${kind}`;
}
