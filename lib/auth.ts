import { MongoDBAdapter } from "@next-auth/mongodb-adapter";
import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import { z } from "zod";
import clientPromise from "./mongodb";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const authSecret =
  process.env.NEXTAUTH_SECRET ?? (process.env.NODE_ENV === "production" ? undefined : "development-only-auth-secret");

export const authOptions: NextAuthOptions = {
  adapter: process.env.MONGODB_URI ? MongoDBAdapter(clientPromise) : undefined,
  pages: {
    signIn: "/login",
    newUser: "/generate?auth=signup",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_ID ?? "",
      clientSecret: process.env.GITHUB_SECRET ?? "",
    }),
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        const email = parsed.data.email.toLowerCase().trim();
        const client = await clientPromise;
        const user = await client
          .db()
          .collection("users")
          .findOne<{ _id: object; name?: string; email: string; image?: string; passwordHash?: string }>({ email });

        if (!user?.passwordHash) {
          return null;
        }

        const isValid = await bcrypt.compare(parsed.data.password, user.passwordHash);

        if (!isValid) {
          return null;
        }

        return {
          id: user._id.toString(),
          name: user.name ?? email.split("@")[0],
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60,
  },
  callbacks: {
    async jwt({ token, user, profile }) {
      const providerImage =
        profile && "picture" in profile && typeof profile.picture === "string"
          ? profile.picture
          : profile && "avatar_url" in profile && typeof profile.avatar_url === "string"
            ? profile.avatar_url
            : undefined;

      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.picture = user.image ?? providerImage ?? token.picture;
      } else if (process.env.MONGODB_URI && token.email && !token.picture) {
        const client = await clientPromise;
        const dbUser = await client
          .db()
          .collection("users")
          .findOne<{ _id: object; name?: string | null; email?: string | null; image?: string | null }>({
            email: String(token.email).toLowerCase(),
          });

        if (dbUser) {
          token.id = token.id ?? dbUser._id.toString();
          token.name = token.name ?? dbUser.name;
          token.email = token.email ?? dbUser.email;
          token.picture = dbUser.image ?? token.picture;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (token.id) {
          session.user.id = String(token.id);
        }

        session.user.name = token.name ?? session.user.name;
        session.user.email = token.email ?? session.user.email;
        session.user.image = token.picture ?? session.user.image;
      }

      return session;
    },
  },
  secret: authSecret,
};
