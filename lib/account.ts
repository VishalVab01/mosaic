import { ObjectId, type Collection, type Db } from "mongodb";

export const FREE_SIGNUP_CREDITS = 10;

export type UserAccount = {
  _id: ObjectId;
  credits?: number;
  email?: string | null;
};

export function getUserFilter(user: { id?: string | null; email?: string | null }) {
  if (user.id && ObjectId.isValid(user.id)) {
    return { _id: new ObjectId(user.id) };
  }

  if (user.email) {
    return { email: user.email.toLowerCase() };
  }

  return null;
}

export async function ensureUserCredits(db: Db, user: { id?: string | null; email?: string | null }) {
  const filter = getUserFilter(user);

  if (!filter) {
    return null;
  }

  const users = db.collection<UserAccount>("users");
  const account = await users.findOne(filter);

  if (!account) {
    return null;
  }

  if (typeof account.credits === "number") {
    return account.credits;
  }

  await users.updateOne({ _id: account._id }, { $set: { credits: FREE_SIGNUP_CREDITS, updatedAt: new Date() } });
  return FREE_SIGNUP_CREDITS;
}

export async function reserveGenerationCredit(users: Collection<UserAccount>, user: { id?: string | null; email?: string | null }) {
  const filter = getUserFilter(user);

  if (!filter) {
    return null;
  }

  const account = await users.findOne(filter);

  if (!account) {
    return null;
  }

  if (typeof account.credits !== "number") {
    await users.updateOne({ _id: account._id }, { $set: { credits: FREE_SIGNUP_CREDITS, updatedAt: new Date() } });
    account.credits = FREE_SIGNUP_CREDITS;
  }

  if (account.credits <= 0) {
    return { ok: false as const, credits: 0, userId: account._id };
  }

  const updated = await users.findOneAndUpdate(
    { _id: account._id, credits: { $gt: 0 } },
    { $inc: { credits: -1 }, $set: { updatedAt: new Date() } },
    { returnDocument: "after" },
  );

  if (!updated.value) {
    const latest = await users.findOne({ _id: account._id });
    return { ok: false as const, credits: latest?.credits ?? 0, userId: account._id };
  }

  return { ok: true as const, credits: updated.value.credits ?? 0, userId: updated.value._id };
}

export async function refundGenerationCredit(users: Collection<UserAccount>, userId: ObjectId) {
  await users.updateOne({ _id: userId }, { $inc: { credits: 1 }, $set: { updatedAt: new Date() } });
}
