import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { FREE_SIGNUP_CREDITS } from "../../../../lib/account";
import clientPromise from "../../../../lib/mongodb";

const signupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Use a valid name, email, and password of at least 8 characters." },
      { status: 400 },
    );
  }

  const email = parsed.data.email.toLowerCase().trim();
  const client = await clientPromise;
  const users = client.db().collection("users");

  await users.createIndex({ email: 1 }, { unique: true });

  const existingUser = await users.findOne({ email });

  if (existingUser) {
    return NextResponse.json({ error: "An account already exists for this email." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const now = new Date();

  await users.insertOne({
    name: parsed.data.name,
    email,
    emailVerified: null,
    image: null,
    passwordHash,
    credits: FREE_SIGNUP_CREDITS,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
