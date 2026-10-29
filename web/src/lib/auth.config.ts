import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { MINUTE, clientIp, isRateLimited } from "@/lib/rate-limit";

export const authConfig = {
  providers: [
    // Only offered when configured; an unconfigured provider would just show a broken button.
    ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
      ? [Google({ clientId: process.env.AUTH_GOOGLE_ID, clientSecret: process.env.AUTH_GOOGLE_SECRET })]
      : []),
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const email = credentials?.email?.toString().toLowerCase().trim();
        const password = credentials?.password?.toString() ?? "";

        if (!email || !password) return null;

        // Slows password guessing: per address (wherever it comes from) and per IP (across addresses).
        const [byEmail, byIp] = await Promise.all([
          isRateLimited(`login-email:${email}`, 10, 15 * MINUTE),
          isRateLimited(`login-ip:${clientIp(request)}`, 30, 15 * MINUTE),
        ]);
        if (byEmail || byIp) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isProtected =
        pathname.startsWith("/admin") ||
        pathname.startsWith("/manager") ||
        pathname.startsWith("/api/admin") ||
        pathname.startsWith("/api/manager");

      if (!isProtected) return true;
      return !!auth?.user;
    },
  },
} satisfies NextAuthConfig;
