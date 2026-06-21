"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Clapperboard,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Paperclip,
  Plug,
  Plus,
  Settings,
  ShoppingBag,
  UserRound,
  X,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import "./generate.css";

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
  const { data: session } = useSession();
  const [figmaLink, setFigmaLink] = useState("");
  const [fileName, setFileName] = useState("");
  const [generationError, setGenerationError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const userInitial = session?.user?.name?.trim().charAt(0).toUpperCase() || session?.user?.email?.charAt(0).toUpperCase() || "M";
  const userImage = imageFailed ? null : session?.user?.image;
  const mockGenerations = [
    {
      title: "YouTube clone",
      prompt: "Build a polished YouTube clone with a responsive sidebar, video grid, search, categories, and a modern dark theme.",
      icon: Clapperboard,
    },
    {
      title: "SaaS dashboard",
      prompt: "Create a modern SaaS analytics dashboard with charts, activity feeds, team management, and responsive navigation.",
      icon: LayoutDashboard,
    },
    {
      title: "Fashion store",
      prompt: "Build a premium fashion ecommerce storefront with product filters, product cards, cart interactions, and a clean editorial style.",
      icon: ShoppingBag,
    },
  ];

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
      setGenerationError("Paste your Figma file URL first.");
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

  function showComingSoon(label: string) {
    setSuccessMessage(`${label} settings are coming soon.`);
    window.setTimeout(() => setSuccessMessage(""), 3200);
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

            <div className="generate-recents">
              <p>Recent generations</p>
              {mockGenerations.map(({ title, prompt, icon: Icon }) => (
                <button
                  key={title}
                  type="button"
                  onClick={() => {
                    setFigmaLink(prompt);
                    setGenerationError("");
                  }}
                >
                  <Icon size={17} />
                  <span>{title}</span>
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
        <div className="generate-success-toast" role="status" aria-live="polite">
          <CheckCircle2 size={18} />
          <span>{successMessage}</span>
        </div>
      )}

      <section className="generate-hero">
        <div className="generate-copy">
          <h1>Turn your Figma designs into production-ready code.</h1>
          <p>
            Paste your Figma link, optionally attach reference images, and generate your application instantly.
          </p>
        </div>

        <div className="generate-composer">
          <textarea
            aria-label="Figma file URL"
            rows={2}
            placeholder="Paste your Figma file URL here..."
            value={figmaLink}
            onChange={(event) => setFigmaLink(event.target.value)}
          />

          <div className="generate-toolbar">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}
            />
            <button
              aria-label={fileName ? `Attached ${fileName}` : "Attach reference image"}
              className="generate-attach-button"
              type="button"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip size={24} />
            </button>

            <button className="generate-run-button" onClick={handleGenerate} type="button">
              Run
            </button>
          </div>

          {generationError && <p className="generate-error-message">{generationError}</p>}
        </div>
      </section>
    </main>
  );
}
