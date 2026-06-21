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
  html: z.string().min(1),
  css: z.string().min(1),
  js: z.string().optional().default(""),
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
              "You are Mosaic, an expert frontend engineer generating polished app prototypes.",
              "Return ONLY valid JSON with this shape:",
              '{"title":"string","summary":"string","html":"string","css":"string","js":"string","notes":["string"]}',
              "Build a complete, realistic single-page app screen or mini-flow based on the user request.",
              "The generated code must be self-contained and previewable inside one HTML document.",
              "Do not use external libraries, remote scripts, remote images, iframes, fetch calls, or backend calls.",
              "Use semantic HTML, accessible labels, polished responsive CSS, and small vanilla JS only if useful.",
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
