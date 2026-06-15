"use client";

import { useSession } from "next-auth/react";
import { Suspense, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import AuthForm from "../components/AuthForm";
import { UserRoundPen } from "lucide-react";
import Link from "next/link";

const heroVideo = "https://framerusercontent.com/assets/iWlVr4qV5BuFxjhc6g7QcPK5o.mp4";

const gradientImages = [
  "https://framerusercontent.com/images/eW5p5p4ByCUrMWJNoLvNUdoOBSM.png",
  "https://framerusercontent.com/images/HAJ6oryEjmZy3Sg5MQzgFBR7i8U.png",
  "https://framerusercontent.com/images/LB9YlzaPgLeQE23v2niIMLhi8c.png",
  "https://framerusercontent.com/images/nz2F1JADzV0oqknhUTE1HXOOE.png",
  "https://framerusercontent.com/images/PuSPK9fNwHImxZIAp2iXhWuyjM.png",
  "https://framerusercontent.com/images/2JQhaxBHmW5sc4O8xOEtc5ogk.png",
];

const navItems = ["About", "Workflow", "Generate", "Contact"];

const coreCards = [
  {
    title: "Figma Import",
    text: "Convert Figma designs into structured frontend layouts automatically. Import frames, components, spacing, and typography without manual setup.",
    icon: "orbit",
  },
  {
    title: "Clean Code Generation",
    text: "Generate responsive React, Next.js, HTML, CSS, and Tailwind code that follows modern development practices and clean component architecture.",
    icon: "data",
  },
  {
    title: "Responsive Conversion",
    text: "Automatically adapt desktop designs for tablet and mobile screens while preserving spacing, alignment, and visual consistency.",
    icon: "layers",
  },
];

// const productSections = [
//   {
//     kicker: "AI chat",
//     title: "Chat experience for fast and smart conversations",
//     text: "A conversational AI assistant that understands your questions, provides intelligent answers, and helps you get things done fast from casual chats to complex tasks.",
//     image: gradientImages[0],
//     tone: "chat",
//   },
//   {
//     kicker: "AI assistant",
//     title: "AI assistant for efficient time management",
//     text: "Let the AI schedule meetings, set reminders, and automatically attach relevant files. Save time and stay better organized with intelligent and context aware planning.",
//     image: gradientImages[1],
//     tone: "assistant",
//   },
//   {
//     kicker: "AI transcription",
//     title: "Audio transcription for fast and accurate text",
//     text: "Automatically convert speech into accurate, editable text in real time. Perfect for meetings, interviews, voice notes, and more, powered by advanced speech recognition technology.",
//     image: gradientImages[2],
//     tone: "audio",
//   },
// ];

const features = [
  ["Voice intelligence", "Convert speech to text, generate realistic audio, and integrate voice commands with seamless AI interaction."],
  ["Video AI", "Analyze, generate, and edit video content with AI-powered tools that save time and unlock creativity."],
  ["Image generation", "Generate high-quality images, graphics, and concepts using cutting-edge generative AI tuned for creativity and speed."],
  ["Text editor", "Generate, analyze, and optimize text with natural language processing designed for clarity, tone, and impact."],
  ["Secure by design", "From encrypted data handling to access controls and model integrity, ensure every action is protected."],
  ["Smart assistant", "Automate workflows, answer questions, and provide real-time support with a conversational AI that learns and adapts."],
];

const nextGen = [
  ["Multilingual AI", "Translate, transcribe, and generate content across global markets."],
  ["Continual Learning", "Your AI improves automatically as it learns from new data."],
  ["Modular Architecture", "Enable or disable components to tailor the platform for your use case."],
  ["Smart Analytics", "Get instant answers from your data with automated dashboards."],
  ["Agent Assist", "Automatically suggest replies and surface relevant documents."],
  ["Workflow Automation", "Automate email replies, data entry, content formatting, and more."],
];

const faqs = [
  "Do I need coding experience to use the platform?",
  "Can my team collaborate on projects together?",
  "How accurate is the generated frontend code?",
  "What happens if the AI generates something incorrect?",
  "Can I customize the generated code manually?",
];

type ManifestoPart = string | { symbol: string };

const manifestoLines = [
  ["We believe frontend development ", { symbol: "✧" }, " should feel creative - not repetitive."],
  ["By building tools that are fast, intelligent, and intuitive, we help developers ", { symbol: "⌘" }, " transform Figma designs into responsive frontend experiences with less manual effort."],
  ["With AI-assisted workflows ", { symbol: "▣" }, " designed for modern creators, we're simplifying the journey from design to deployment."],
] satisfies ManifestoPart[][];

function Logo() {
  return (
    <a className="brand" href="#">
      <span className="brand-mark" aria-hidden="true" />
      <span>Mosaic</span>
    </a>
  );
}

function Button({
  children,
  href = "#",
  onClick,
  variant = "primary",
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "ghost";
}) {
  return (
    <a
      className={`button ${variant}`}
      href={href}
      onClick={(event) => {
        if (onClick) {
          event.preventDefault();
          onClick();
        }
      }}
    >
      {children}
    </a>
  );
}

function Mockup({ tone, image }: { tone: string; image: string }) {
  return (
    <div className="mockup" style={{ backgroundImage: `url(${image})` }}>
      <div className={`floating-ui ${tone}`}>
        {tone === "chat" && (
          <>
            <div className="chips">
              <span>Create image</span>
              <span>Summarize text</span>
            </div>
            <div className="prompt-row">
              <b>+</b>
              <span>Ask anything...</span>
              <i />
            </div>
          </>
        )}
        {tone === "assistant" && (
          <div className="assistant-card">
            <small>AI Assistant</small>
            <p>I&apos;ve just finished creating a document to support your meeting tomorrow.</p>
            <div className="file-row">
              <span />
              <b>Meeting deck</b>
              <i>↓</i>
            </div>
          </div>
        )}
        {tone === "audio" && (
          <div className="audio-card">
            <div className="wave">
              <b>▶</b>
              <span>11:06 AM - Chris</span>
              <i />
            </div>
            <small>Transcription</small>
            <p>Yeah, I did. I think Monday and Wednesday look packed, but Thursday&apos;s pretty open.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AnimatedWords({ parts }: { parts: ManifestoPart[] }) {
  return (
    <>
      {parts.map((part, partIndex) => {
        if (typeof part !== "string") {
          return (
            <span className="manifesto-word" key={`symbol-${partIndex}`}>
              <strong>{part.symbol}</strong>
            </span>
          );
        }

        return part.split(/(\s+)/).map((word, wordIndex) => {
          if (/^\s+$/.test(word)) {
            return word;
          }

          if (!word) {
            return null;
          }

          return (
            <span className="manifesto-word" key={`${partIndex}-${wordIndex}`}>
              {word}
            </span>
          );
        });
      })}
    </>
  );
}


function LineIcon({ type }: { type: string }) {
  return (
    <span className={`line-icon ${type}`} aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

export default function Home() {
  const manifestoRef = useRef<HTMLElement>(null);
  const [authMode, setAuthMode] = useState<"login" | "signup" | null>(null);

  const { data: session, status } = useSession();

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const context = gsap.context(() => {
      const words = gsap.utils.toArray<HTMLElement>(".manifesto-word");

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: manifestoRef.current,
          start: "top 20%",
          end: "+=1200",
          scrub: 2,
          pin: true,
        },
      });

      tl.fromTo(
        words,
        {
          opacity: 0.1,
          filter: "blur(8px)",
        },
        {
          opacity: 1,
          filter: "blur(0px)",
          stagger: 0.1,
          ease: "none",
          duration: 1,
        }
      );
    }, manifestoRef);

    return () => context.revert();
  }, []);

  return (
    <main>
      <header className="site-header">
        <Logo />
        <nav>
          {navItems.map((item) => (
            <a href={`#${item.toLowerCase()}`} key={item}>
              {item}
            </a>
          ))}

        </nav>
          <div className="header-auth">


                    {status === "loading" ? (
              <div style={{ width: "42px", height: "42px" }} />
            ) : session ? (
              <div>

              <Link href="/profile" className="profile-btn">
                <UserRoundPen size={20} />
              </Link>
              </div>
            ) : (
              <Button href="/signup" onClick={() => setAuthMode("signup")}>
                Get started
              </Button>
            )}
            </div>

          
      </header>

      <section className="hero">
        <video aria-hidden="true" autoPlay muted loop playsInline src={heroVideo} />
        <div className="hero-content">
          {/* <a className="pill" href="#">✦ Announcing API 2.0</a> */}
          <h1>
            Your Figma deserves <em> better</em> than manual coding. 
          </h1>
          <p>Generate clean, responsive frontend code directly from your Figma designs using AI-powered automation.</p>
          <div className="actions">
            <Button href="/signup" onClick={() => setAuthMode("signup")}>Get started</Button>
            <Button href="/login" onClick={() => setAuthMode("login")} variant="ghost">Sign in</Button>
          </div>
        </div>
      </section>

 <section className="logos" id="about">
  <p>they hate us coz they ain't us</p>
  <h5>Powered By</h5>

  <div className="marquee-track">
    <div className="marquee-inner">
      {[
        "Sarcasm",
        "God complex",
        "Cuteness",
        "Humour",
        "Sarcasm",
        "God complex",
        "Cuteness",
        "Humour",
      ].map((logo, i) => (
        <span key={i}>
          {logo}
          <em>✦</em>
        </span>
      ))}
    </div>
  </div>
</section>

      <section className="manifesto" ref={manifestoRef}>
        <div className="manifesto-copy">
          {manifestoLines.map((line, index) => (
            <p key={index}>
              <AnimatedWords parts={line} />
            </p>
          ))}
        </div>
      </section>

      <section className="core">
        <h2>The core of smarter innovation</h2>
        <div className="core-grid">
          {coreCards.map((card) => (
            <article className="core-card" key={card.title}>
              <LineIcon type={card.icon} />
              <h3>{card.title}</h3>
              <p>{card.text}</p>
              <Button href="/signup" onClick={() => setAuthMode("signup")} variant="ghost">Get started</Button>
            </article>
          ))}
        </div>
      </section>

      <section className="products">
        {/* {productSections.map((section, index) => (
          <article className="product-row" key={section.title}>
            <div className="product-copy">
              <span className="kicker">✧ {section.kicker}</span>
              <h2>{section.title}</h2>
              <p>{section.text}</p>
              <Button href="/signup" onClick={() => setAuthMode("signup")} variant="ghost">Get started</Button>
            </div>
            <Mockup tone={section.tone} image={section.image} />
          </article>
        ))} */}
      </section>

      {/* <section className="feature-section">
        <h2>Explore the powerful AI features that drive business growth</h2>
        <div className="feature-grid">
          {features.map(([title, text], index) => (
            <article key={title}>
              <span>{["◌", "▻", "✦", "T", "AI", "☊"][index]}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section> */}

      <section className="case-studies">
        <h2>Accelerate Frontend Development</h2>
            <article>
        <div className="case-copy">
          <h3>
            Turn Figma designs into production-ready frontend code.
          </h3>

          <div className="stats">
            <b>5 Min</b>
            <span>Generation Time</span>

            <b>80%</b>
            <span>Less Manual Work</span>
          </div>

          <Button
            href="/signup"
            onClick={() => setAuthMode("signup")}
            variant="ghost"
          >
            Generate Code
          </Button>
        </div>

        <div className="brand-tile blue">
          FIGMA → REACT
        </div>
      </article>

<article className="reverse">
  <div className="brand-tile gold">
    REACT + TAILWIND
  </div>

  <div className="case-copy">
    <h3>
      Responsive components generated automatically.
    </h3>

    <div className="stats">
      <b>100%</b>
      <span>Responsive</span>

      <b>React</b>
      <span>Ready</span>
    </div>

    <Button
      href="/signup"
      onClick={() => setAuthMode("signup")}
      variant="ghost"
    >
      Learn More
    </Button>
  </div>
</article>
      </section>

      {/* <section className="integrations">
        <div>
          <h2>Seamless integrations with your favorite tools</h2>
          <p>Connect our AI with the apps you already use, including calendars, docs, messaging platforms, and more.</p>
          <Button href="/signup" onClick={() => setAuthMode("signup")} variant="ghost">Get started</Button>
        </div>
        <div className="integration-cloud" aria-hidden="true">
          {Array.from({ length: 18 }).map((_, i) => (
            <span key={i}>{["◆", "✳", "◒", "◈", "▰", "✦"][i % 6]}</span>
          ))}
        </div>
      </section> */}

      {/* <section className="next-gen" id="pricing">
        <div className="section-heading">
          <h2>Next-gen AI features</h2>
          <div className="arrow-buttons"><button>‹</button><button>›</button></div>
        </div>
        <div className="carousel">
          {nextGen.map(([title, text], index) => (
            <article key={title} style={{ backgroundImage: `url(${gradientImages[index % gradientImages.length]})` }}>
              <button aria-label={`Expand ${title}`}>+</button>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section> */}

      <section className="quote">
        <blockquote>&quot;The AI does the heavy lifting so our team can focus on strategy. We&apos;re faster, more efficient, and more confident in decisions.&quot;</blockquote>
        <div className="person"><span /> <p><b>Daniel Ortiz</b><small>Product Manager at CloudNest</small></p></div>
      </section>

      <section className="faq" id="contact">
        <h2>We&apos;ve got answers</h2>
        <div className="faq-list">
          {faqs.map((faq) => (
            <details key={faq}>
              <summary>{faq}<span>+</span></summary>
              <p>backend guy is responsible</p>
            </details>
          ))}
        </div>
      </section>

      <section className="cta">
        <video aria-hidden="true" autoPlay muted loop playsInline src={heroVideo} />
        <h2>Ready to automate everything?</h2>

        <div className="actions">
          <Button href="/signup" onClick={() => setAuthMode("signup")}>Get started</Button>
          <Button variant="ghost">Learn more</Button>
        </div>
      </section>

      <footer>
        <div>
          <Logo 
          />
          <p>Built for modern fr
            ontend workflows.</p>
        </div>
        <div>
          <h3>Product</h3>
          {navItems.map((item) => <a href="#" key={item}>{item}</a>)}
        </div>
        <div>
          <h3>Legal</h3>
          {["Terms of service", "Privacy policy", "404"].map((item) => <a href="#" key={item}>{item}</a>)}
        </div>
        <div>
          <h3>Connect</h3>
          {["Instagram", "LinkedIn", "Twitter / X"].map((item) => <a href="#" key={item}>{item}</a>)}
        </div>
        
        <p className="copyright">Made with ❤️ by Diya & Vishal</p>
      </footer>

      {authMode && (
        <div className="auth-modal" role="dialog" aria-modal="true" aria-label="Authentication">
          <button className="auth-modal-backdrop" aria-label="Close authentication" onClick={() => setAuthMode(null)} />
          <div className="auth-modal-panel">
            <button className="auth-modal-close" type="button" aria-label="Close" onClick={() => setAuthMode(null)}>
              x
            </button>
            <Suspense fallback={null}>
              <AuthForm mode={authMode} onModeChange={setAuthMode} />
            </Suspense>
          </div>
        </div>
      )}
    </main>
  );
}
