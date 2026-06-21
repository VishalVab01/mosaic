import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "../../../lib/auth";

const requestSchema = z.object({
  figmaLink: z.string().trim().optional(),
  prompt: z.string().trim().min(8, "Describe what you want to build."),
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

  try {
    const result = await generateWithGemini({
      apiKey,
      figmaLink: parsed.data.figmaLink,
      prompt: parsed.data.prompt,
    });

    return NextResponse.json({ generation: result });
  } catch (error) {
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
}: {
  apiKey: string;
  figmaLink?: string;
  prompt: string;
}) {
  const preferredModel = process.env.GEMINI_MODEL?.trim();
  const models = Array.from(new Set([preferredModel, ...fallbackModels].filter(Boolean))) as string[];
  const payload = createGeminiPayload({ figmaLink, prompt });
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

function createGeminiPayload({ figmaLink, prompt }: { figmaLink?: string; prompt: string }) {
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
              "Return ONLY valid JSON with this shape:",
              '{"title":"string","summary":"string","previewHtml":"string","previewCss":"string","previewJs":"string","files":[{"path":"string","content":"string"}],"notes":["string"]}',
              "Build a complete, realistic React + Tailwind app screen or mini-flow based on the user request.",
              "The files array must represent a proper Vite React project folder structure.",
              "Always include at least these files: package.json, index.html, src/main.jsx, src/App.jsx, src/index.css, tailwind.config.js, postcss.config.js, README.md.",
              "Use package.json dependencies compatible with a standard Vite React Tailwind project: react, react-dom, @vitejs/plugin-react, vite, tailwindcss 3.x, postcss, and autoprefixer.",
              "Use Tailwind utility classes throughout the React components. Keep custom CSS minimal and only for base styles or animations.",
              "Do not use remote images, iframes, backend calls, or paid libraries. Use local gradients, SVG, CSS, and realistic placeholder data.",
              "previewHtml/previewCss/previewJs must be a self-contained static preview of the generated app for an iframe. It should visually match the React output.",
              "The generated React code should be clean, componentized when useful, accessible, responsive, and ready to run with npm install && npm run dev.",
              "Avoid markdown fences. Avoid explanations outside JSON.",
              "",
              `User prompt: ${prompt}`,
              figmaLink ? `Figma/reference link: ${figmaLink}` : "Figma/reference link: none provided",
            ].join("\n"),
          },
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
