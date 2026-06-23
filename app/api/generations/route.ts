import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserFilter } from "../../../lib/account";
import { authOptions } from "../../../lib/auth";
import clientPromise from "../../../lib/mongodb";

type StoredGeneration = {
  _id: ObjectId;
  userId: ObjectId;
  title: string;
  summary: string;
  previewHtml: string;
  previewCss: string;
  previewJs?: string;
  files: Array<{ path: string; content: string }>;
  notes?: string[];
  prompt: string;
  figmaLink?: string;
  generatedAt: Date;
  starred?: boolean;
};

const updateGenerationSchema = z.object({
  id: z.string().refine((value) => ObjectId.isValid(value), "Invalid project id."),
  title: z.string().trim().min(1).max(120).optional(),
  starred: z.boolean().optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const userFilter = getUserFilter(session.user);

  if (!userFilter) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  const client = await clientPromise;
  const user = await client.db().collection("users").findOne<{ _id: ObjectId }>(userFilter, { projection: { _id: 1 } });

  if (!user) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  const generations = await client
    .db()
    .collection<StoredGeneration>("generations")
    .find({ userId: user._id })
    .sort({ generatedAt: -1 })
    .limit(12)
    .toArray();

  return NextResponse.json({
    generations: generations.map((generation) => ({
      id: generation._id.toString(),
      title: generation.title,
      summary: generation.summary,
      previewHtml: generation.previewHtml,
      previewCss: generation.previewCss,
      previewJs: generation.previewJs ?? "",
      files: generation.files,
      notes: generation.notes ?? [],
      prompt: generation.prompt,
      starred: generation.starred ?? false,
      generatedAt: generation.generatedAt.toISOString(),
    })),
  });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const parsed = updateGenerationSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  const userFilter = getUserFilter(session.user);

  if (!userFilter) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  const client = await clientPromise;
  const db = client.db();
  const user = await db.collection("users").findOne<{ _id: ObjectId }>(userFilter, { projection: { _id: 1 } });

  if (!user) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  const updates: Partial<Pick<StoredGeneration, "starred" | "title">> & { updatedAt: Date } = {
    updatedAt: new Date(),
  };

  if (parsed.data.title !== undefined) {
    updates.title = parsed.data.title;
  }

  if (parsed.data.starred !== undefined) {
    updates.starred = parsed.data.starred;
  }

  const result = await db.collection<StoredGeneration>("generations").findOneAndUpdate(
    { _id: new ObjectId(parsed.data.id), userId: user._id },
    { $set: updates },
    { returnDocument: "after" },
  );

  if (!result.value) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  return NextResponse.json({
    generation: {
      id: result.value._id.toString(),
      title: result.value.title,
      starred: result.value.starred ?? false,
    },
  });
}
