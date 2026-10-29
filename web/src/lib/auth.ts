import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";
import type { Role } from "@prisma/client";

export type UserRole = Role;

const PLACEHOLDER_SECRETS = ["generate-a-random-secret-here", "dev-secret-key-710-store-random-value-change-in-prod"];
const secret = process.env.AUTH_SECRET ?? "";
const weakSecret = secret.length < 32 || PLACEHOLDER_SECRETS.includes(secret);

// A guessable secret lets anyone sign an admin session, so a live server refuses to start without a real one.
// `next build` also runs with NODE_ENV=production; it never signs sessions, so it is allowed through.
if (weakSecret && process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
  throw new Error("AUTH_SECRET is missing or too weak. Set a random value of 32+ characters (openssl rand -base64 32).");
}
if (!secret) {
  process.env.AUTH_SECRET = "dev-only-secret-not-for-production-use-0000";
}

const ROLE_REFRESH_MS = 5 * 60 * 1000;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      // The role is re-read every few minutes, so a demoted or deleted admin loses access without waiting for the token to expire.
      const checkedAt = typeof token.roleCheckedAt === "number" ? token.roleCheckedAt : 0;
      if (token.sub && (user?.id || Date.now() - checkedAt > ROLE_REFRESH_MS)) {
        const dbUser = await prisma.user.findUnique({ where: { id: token.sub }, select: { role: true } });
        if (!dbUser) return null;
        token.role = dbUser.role;
        token.roleCheckedAt = Date.now();
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.role = (token.role as UserRole) ?? "CUSTOMER";
      }
      return session;
    },
  },
});

export async function requireRole(roles: UserRole[]) {
  const session = await auth();
  if (!session?.user?.id || !roles.includes(session.user.role)) {
    return null;
  }
  return session;
}

export async function requireAdmin() {
  return requireRole(["ADMIN"]);
}

export async function requireManager() {
  return requireRole(["MANAGER", "ADMIN"]);
}

export async function requireStaff() {
  return requireRole(["MANAGER", "ADMIN"]);
}
