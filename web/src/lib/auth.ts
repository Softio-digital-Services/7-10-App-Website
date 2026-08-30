import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";
import type { Role } from "@prisma/client";

export type UserRole = Role;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user?.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true },
        });
        token.role = dbUser?.role ?? "CUSTOMER";
        token.sub = user.id;
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
