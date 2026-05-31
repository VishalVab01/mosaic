const heroVideo = "https://framerusercontent.com/assets/iWlVr4qV5BuFxjhc6g7QcPK5o.mp4";

const gradientImages = [
  "https://framerusercontent.com/images/eW5p5p4ByCUrMWJNoLvNUdoOBSM.png",
  "https://framerusercontent.com/images/HAJ6oryEjmZy3Sg5MQzgFBR7i8U.png",
  "https://framerusercontent.com/images/LB9YlzaPgLeQE23v2niIMLhi8c.png",
  "https://framerusercontent.com/images/nz2F1JADzV0oqknhUTE1HXOOE.png",
  "https://framerusercontent.com/images/PuSPK9fNwHImxZIAp2iXhWuyjM.png",
  "https://framerusercontent.com/images/2JQhaxBHmW5sc4O8xOEtc5ogk.png",
];

const navItems = ["About", "Pricing", "Changelog", "Contact"];

const coreCards = [
  {
    title: "AI Automation",
    text: "Automate routine tasks like lead handling and customer replies to let your team focus on what matters most.",
    icon: "orbit",
  },
  {
    title: "Data Insights",
    text: "Discover trends, predict user behavior, and segment your audience with precision to make smarter, data-backed business decisions.",
    icon: "data",
  },
  {
    title: "Adaptive AI",
    text: "We build AI systems that grow with your business, adapt to your data, and keep you ahead in a changing market.",
    icon: "layers",
  },
];

const productSections = [
  {
    kicker: "AI chat",
    title: "Chat experience for fast and smart conversations",
    text: "A conversational AI assistant that understands your questions, provides intelligent answers, and helps you get things done fast from casual chats to complex tasks.",
    image: gradientImages[0],
    tone: "chat",
  },
  {
    kicker: "AI assistant",
    title: "AI assistant for efficient time management",
    text: "Let the AI schedule meetings, set reminders, and automatically attach relevant files. Save time and stay better organized with intelligent and context aware planning.",
    image: gradientImages[1],
    tone: "assistant",
  },
  {
    kicker: "AI transcription",
    title: "Audio transcription for fast and accurate text",
    text: "Automatically convert speech into accurate, editable text in real time. Perfect for meetings, interviews, voice notes, and more, powered by advanced speech recognition technology.",
    image: gradientImages[2],
    tone: "audio",
  },
];

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
  "Is my data safe with your platform?",
  "What kind of customer support do you offer?",
  "How does the pricing for your web solution work?",
  "Can I cancel my subscription at any time?",
  "Can I upgrade or downgrade my subscription plan?",
];

function Logo() {
  return (
    <a className="brand" href="#">
      <span className="brand-mark" aria-hidden="true" />
      <span>MONO AI</span>
    </a>
  );
}

function Button({ children, variant = "primary" }: { children: React.ReactNode; variant?: "primary" | "ghost" }) {
  return (
    <a className={`button ${variant}`} href="#">
      {children}
    </a>
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

export default function Home() {
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
        <Button>Get started</Button>
      </header>

      <section className="hero">
        <video aria-hidden="true" autoPlay muted loop playsInline src={heroVideo} />
        <div className="hero-content">
          <a className="pill" href="#">✦ Announcing API 2.0</a>
          <h1>
            The AI layer that brings <em>clarity</em> to complexity.
          </h1>
          <p>Our platform integrates seamlessly into your stack to deliver real-time understanding, not just predictions.</p>
          <div className="actions">
            <Button>Get started</Button>
            <Button variant="ghost">Learn more</Button>
          </div>
        </div>
      </section>

      <section className="logos" id="about">
        <p>Trusted by industry leaders</p>
        <div>
          {["Springfield", "Orbitc", "Cloud", "Amsterdam"].map((logo) => (
            <span key={logo}>{logo}</span>
          ))}
        </div>
      </section>

      <section className="manifesto">
        <p>We believe that AI <strong>✧</strong> should amplify human potential-not replace it.</p>
        <p>By designing tools that are smart, ethical, and intuitive, we help people <strong>⌘</strong> unlock deeper insights, work more creatively, and make better decisions.</p>
        <p>With technology <strong>▣</strong> that adapts to real-world needs, we&apos;re shaping a future where humans and AI build together.</p>
      </section>

      <section className="core">
        <h2>The core of smarter innovation</h2>
        <div className="core-grid">
          {coreCards.map((card) => (
            <article className="core-card" key={card.title}>
              <LineIcon type={card.icon} />
              <h3>{card.title}</h3>
              <p>{card.text}</p>
              <Button variant="ghost">Get started</Button>
            </article>
          ))}
        </div>
      </section>

      <section className="products">
        {productSections.map((section, index) => (
          <article className="product-row" key={section.title}>
            <div className="product-copy">
              <span className="kicker">✧ {section.kicker}</span>
              <h2>{section.title}</h2>
              <p>{section.text}</p>
              <Button variant="ghost">Get started</Button>
            </div>
            <Mockup tone={section.tone} image={section.image} />
          </article>
        ))}
      </section>

      <section className="feature-section">
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
      </section>

      <section className="case-studies">
        <h2>Meet the companies working more efficiently with AI</h2>
        <article>
          <div className="case-copy">
            <h3>&quot;Working with this AI platform helped us launch faster and smarter than ever before.&quot;</h3>
            <div className="stats"><b>+50%</b><span>Conversion</span><b>+144%</b><span>ROI</span></div>
            <Button variant="ghost">Get started</Button>
          </div>
          <div className="brand-tile blue">Cloud</div>
        </article>
        <article className="reverse">
          <div className="brand-tile gold">Proline</div>
          <div className="case-copy">
            <h3>&quot;We&apos;ve seen a 40% drop in support tickets after integrating their AI assistant.&quot;</h3>
            <div className="stats"><b>+119%</b><span>Conversion</span><b>+208%</b><span>ROI</span></div>
            <Button variant="ghost">Get started</Button>
          </div>
        </article>
      </section>

      <section className="integrations">
        <div>
          <h2>Seamless integrations with your favorite tools</h2>
          <p>Connect our AI with the apps you already use, including calendars, docs, messaging platforms, and more.</p>
          <Button variant="ghost">Get started</Button>
        </div>
        <div className="integration-cloud" aria-hidden="true">
          {Array.from({ length: 18 }).map((_, i) => (
            <span key={i}>{["◆", "✳", "◒", "◈", "▰", "✦"][i % 6]}</span>
          ))}
        </div>
      </section>

      <section className="next-gen" id="pricing">
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
      </section>

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
              <p>Yes. MONO AI is designed around secure data handling, flexible plans, and responsive support for growing teams.</p>
            </details>
          ))}
        </div>
      </section>

      <section className="cta">
        <video aria-hidden="true" autoPlay muted loop playsInline src={heroVideo} />
        <h2>Ready to automate everything?</h2>
        <div className="actions">
          <Button>Get started</Button>
          <Button variant="ghost">Learn more</Button>
        </div>
      </section>

      <footer>
        <div>
          <Logo />
          <p>Speed, scale, and smarts - deployed.</p>
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
          {["Instagram", "YouTube", "LinkedIn", "Twitter / X"].map((item) => <a href="#" key={item}>{item}</a>)}
        </div>
        <p className="copyright">© 2026 MONO AI. All rights reserved <span>by Dream Studio</span> <span>Made in Framer</span></p>
      </footer>
    </main>
  );
}
