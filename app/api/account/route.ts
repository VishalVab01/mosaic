import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { ensureUserCredits, FREE_SIGNUP_CREDITS } from "../../../lib/account";
import { authOptions } from "../../../lib/auth";
import clientPromise from "../../../lib/mongodb";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const client = await clientPromise;
  const credits = await ensureUserCredits(client.db(), session.user);

  if (credits === null) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  return NextResponse.json({ credits, creditLimit: FREE_SIGNUP_CREDITS });
}
