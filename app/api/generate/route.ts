import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { FREE_SIGNUP_CREDITS, reserveGenerationCredit, refundGenerationCredit, type UserAccount } from "../../../lib/account";
import { authOptions } from "../../../lib/auth";
import clientPromise from "../../../lib/mongodb";

const requestSchema = z.object({
  figmaLink: z.string().trim().optional(),
  prompt: z.string().trim().min(3, "Describe what you want to build."),
  referenceImage: z
    .object({
      data: z.string().min(1),
      mimeType: z.string().min(1),
      name: z.string().min(1),
    })
    .optional(),
  currentGeneration: z
    .object({
      title: z.string().optional(),
      summary: z.string().optional(),
      prompt: z.string().optional(),
      previewHtml: z.string().optional(),
      previewCss: z.string().optional(),
      previewJs: z.string().optional(),
      files: z
        .array(
          z.object({
            path: z.string().min(1),
            content: z.string(),
          }),
        )
        .optional(),
    })
    .optional(),
});

const generationSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  previewHtml: z.string().min(1),
  previewCss: z.string().min(1),
  previewJs: z.string().optional().default(""),
  files: z
    .array(
      z.object({
        path: z.string().min(1),
        content: z.string(),
      }),
    )
    .min(1),
  notes: z.array(z.string()).optional().default([]),
});

const fallbackModels = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "You must be signed in to generate." }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "Gemini API key is not configured." }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  const client = await clientPromise;
  const db = client.db();
  const users = db.collection<UserAccount>("users");
  const creditReservation = await reserveGenerationCredit(users, session.user);

  if (!creditReservation) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  if (!creditReservation.ok) {
    return NextResponse.json(
      { error: "You are out of credits. Buy a plan to keep generating.", creditsRemaining: creditReservation.credits, creditLimit: FREE_SIGNUP_CREDITS },
      { status: 402 },
    );
  }

  try {
    const result = await generateWithGemini({
      apiKey,
      figmaLink: parsed.data.figmaLink,
      prompt: parsed.data.prompt,
      referenceImage: parsed.data.referenceImage,
      currentGeneration: parsed.data.currentGeneration,
    });

    const now = new Date();
    const saved = await db.collection("generations").insertOne({
      ...result,
      prompt: parsed.data.prompt,
      figmaLink: parsed.data.figmaLink,
      referenceImageName: parsed.data.referenceImage?.name,
      userId: creditReservation.userId,
      generatedAt: now,
      createdAt: now,
    });

    return NextResponse.json({
      generation: result,
      generationId: saved.insertedId.toString(),
      creditsRemaining: creditReservation.credits,
      creditLimit: FREE_SIGNUP_CREDITS,
    });
  } catch (error) {
    await refundGenerationCredit(users, creditReservation.userId);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed. Please try again." },
      { status: 500 },
    );
  }
}

async function generateWithGemini({
  apiKey,
  figmaLink,
  prompt,
  referenceImage,
  currentGeneration,
}: {
  apiKey: string;
  figmaLink?: string;
  prompt: string;
  referenceImage?: { data: string; mimeType: string; name: string };
  currentGeneration?: z.infer<typeof requestSchema>["currentGeneration"];
}) {
  const preferredModel = process.env.GEMINI_MODEL?.trim();
  const models = Array.from(new Set([preferredModel, ...fallbackModels].filter(Boolean))) as string[];
  const payload = createGeminiPayload({ figmaLink, prompt, referenceImage, currentGeneration });
  const errors: string[] = [];

  for (const model of models) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json().catch(() => null)) as GeminiResponse | null;

    if (!response.ok) {
      errors.push(data?.error?.message ?? `${model} returned ${response.status}`);
      continue;
    }

    const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n").trim();

    if (!text) {
      errors.push(`${model} returned an empty response`);
      continue;
    }

    return parseGeneration(text);
  }

  throw new Error(errors[0] ?? "Gemini did not return a usable generation.");
}

function createGeminiPayload({
  figmaLink,
  prompt,
  referenceImage,
  currentGeneration,
}: {
  figmaLink?: string;
  prompt: string;
  referenceImage?: { data: string; mimeType: string; name: string };
  currentGeneration?: z.infer<typeof requestSchema>["currentGeneration"];
}) {
  const currentProjectContext = currentGeneration
    ? [
        "",
        "Existing project context for a follow-up edit:",
        `Current title: ${currentGeneration.title ?? "Untitled"}`,
        `Original/previous prompt: ${currentGeneration.prompt ?? "none"}`,
        `Current summary: ${currentGeneration.summary ?? "none"}`,
        "When existing project context is provided, treat the user prompt as an edit request. Preserve the existing app concept, pages, layout, content, interactions, responsiveness, and file structure unless the user explicitly asks to replace them.",
        "Return the FULL updated project JSON, not a patch. Include every required file with complete updated contents.",
        "Current previewHtml:",
        truncateForPrompt(currentGeneration.previewHtml ?? "", 9000),
        "Current previewCss:",
        truncateForPrompt(currentGeneration.previewCss ?? "", 9000),
        currentGeneration.previewJs ? `Current previewJs:\n${truncateForPrompt(currentGeneration.previewJs, 4500)}` : "Current previewJs: none",
        "Current files:",
        serializeFilesForPrompt(currentGeneration.files ?? []),
      ].join("\n")
    : "";

  return {
    generationConfig: {
      temperature: 0.55,
      topP: 0.9,
      responseMimeType: "application/json",
    },
    contents: [
      {
        role: "user",
        parts: [
          {
            text: [
              "You are Mosaic, an expert React frontend engineer generating polished app prototypes.",
              "You are also an elite UI/UX designer and React architect. Your output should feel indistinguishable from modern products built with v0, Lovable, Linear, Stripe, Vercel, Notion, and Apple-level design standards.",
              "Return ONLY valid JSON with this shape:",
              '{"title":"string","summary":"string","previewHtml":"string","previewCss":"string","previewJs":"string","files":[{"path":"string","content":"string"}],"notes":["string"]}',
              "First infer the product type, target audience, and primary user action. Then build a complete, realistic React + Tailwind website, app screen, dashboard, landing page, or mini-flow based on the user request.",
              "The files array must represent a proper Vite React project folder structure.",
              "Always include at least these files: package.json, index.html, src/main.jsx, src/App.jsx, src/index.css, tailwind.config.js, postcss.config.js, README.md.",
              "If the app naturally has multiple pages or major views, implement real in-app navigation in src/App.jsx using route state or hash navigation, and include matching links in previewHtml with href values like /, #pricing, #settings, or #dashboard.",
              "The previewHtml navigation links must correspond to visible sections or views so an external page selector can activate them.",
              "Use package.json dependencies compatible with a standard Vite React Tailwind project: react, react-dom, @vitejs/plugin-react, vite, tailwindcss 3.x, postcss, and autoprefixer.",
              "Use React and Tailwind CSS only. Use Tailwind utility classes throughout the React components. Keep custom CSS minimal and only for base styles, keyframes, or small animations.",
              "Design quality is as important as functionality. Prioritize spacing, typography, hierarchy, alignment, visual balance, and responsive polish.",
              "Mobile-first responsive design is required. Every layout must work on mobile, tablet, and desktop.",
              "Use max-w-7xl or equivalent max-width containers for major sections. Use generous whitespace, balanced sections, intelligent grids, and consistent alignment.",
              "Prefer large typography and strong hierarchy: text-4xl through text-7xl for major headings when appropriate, with readable body copy and clear secondary text.",
              "Prefer p-6, p-8, p-10, p-12; gap-6, gap-8, gap-10; rounded-xl, rounded-2xl, rounded-3xl; subtle borders; shadow-md/shadow-lg; and restrained premium gradients.",
              "Avoid cramped p-2 layouts, tiny text, default-looking buttons, generic boxy cards, outdated styling, excessive text density, and beginner tutorial aesthetics.",
              "Use modern card-based UI patterns where useful. Every section should feel intentionally designed rather than templated.",
              "Add hover states, focus states, transitions, micro-interactions, loading/empty states where appropriate, and accessibility considerations such as semantic elements, aria labels, visible focus, and sufficient contrast.",
              "Use realistic mock content and domain-specific details instead of lorem ipsum.",
              "Write reusable React components with clean names and minimal duplication. Separate major sections into components when appropriate.",
              "Do not use remote images, iframes, backend calls, or paid libraries. Use local gradients, SVG, CSS, and realistic placeholder data.",
              "previewHtml/previewCss/previewJs must be a self-contained static preview of the generated app for an iframe. It should visually match the React output.",
              "CRITICAL PREVIEW RULES: previewHtml must contain visible body markup, not an empty #root element, not JSX, and not a full HTML document. Do not include html/head/body/style/script tags in previewHtml.",
              "previewCss must be ordinary browser CSS without @tailwind directives or style tags. previewJs must be plain browser JavaScript without imports, exports, JSX, TypeScript, or script tags.",
              "The preview may use Tailwind utility classes because the preview iframe loads Tailwind CDN, but include enough visible markup that it renders immediately without React.",
              "The generated React code should be clean, componentized when useful, accessible, responsive, and ready to run with npm install && npm run dev.",
              "Before returning JSON, self-review spacing, typography hierarchy, responsiveness, visual polish, accessibility, and whether any section feels generic. Upgrade weak sections until the result feels production-ready for paying customers.",
              "For follow-up edit requests like changing font size, colors, spacing, copy, sections, responsiveness, or component behavior, update the existing project directly and keep everything else stable.",
              "Avoid markdown fences. Avoid explanations outside JSON.",
              currentProjectContext,
              "",
              `User prompt: ${prompt}`,
              figmaLink ? `Figma/reference link: ${figmaLink}` : "Figma/reference link: none provided",
              referenceImage
                ? `Reference image attached: ${referenceImage.name}. Use it as visual guidance for layout, spacing, typography, colors, and cloning the design when requested.`
                : "Reference image attached: none",
            ].join("\n"),
          },
          ...(referenceImage
            ? [
                {
                  inline_data: {
                    data: referenceImage.data,
                    mime_type: referenceImage.mimeType,
                  },
                },
              ]
            : []),
        ],
      },
    ],
  };
}

function parseGeneration(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");

  const jsonStart = cleaned.indexOf("{");
  const jsonEnd = cleaned.lastIndexOf("}");
  const jsonText = jsonStart >= 0 && jsonEnd > jsonStart ? cleaned.slice(jsonStart, jsonEnd + 1) : cleaned;
  const parsed = generationSchema.safeParse(JSON.parse(jsonText));

  if (!parsed.success) {
    throw new Error("Gemini returned code in an unexpected format. Please try again.");
  }

  return parsed.data;
}

function serializeFilesForPrompt(files: Array<{ path: string; content: string }>) {
  const importantFiles = files
    .filter((file) =>
      [
        "package.json",
        "index.html",
        "src/main.jsx",
        "src/App.jsx",
        "src/index.css",
        "tailwind.config.js",
        "postcss.config.js",
        "README.md",
      ].includes(file.path),
    )
    .slice(0, 10);

  if (importantFiles.length === 0) {
    return "No files available.";
  }

  return importantFiles
    .map((file) => `--- ${file.path} ---\n${truncateForPrompt(file.content, 12000)}`)
    .join("\n\n");
}

function truncateForPrompt(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}\n...[truncated]`;
}
