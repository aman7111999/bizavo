import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(rawCredentials) {
        const parsed = loginSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;
        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() }
        });
        if (!user?.passwordHash) return null;
        const valid = await compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;
        return { id: user.id, email: user.email, name: user.name, image: user.image };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      const userId = user?.id ?? token.sub;
      if (userId && (!token.organizationId || user)) {
        const membership = await prisma.membership.findFirst({
          where: { userId },
          orderBy: { createdAt: "asc" },
          include: { organization: { select: { name: true, slug: true, currency: true } } }
        });
        if (membership) {
          token.organizationId = membership.organizationId;
          token.organizationName = membership.organization.name;
          token.organizationSlug = membership.organization.slug;
          token.currency = membership.organization.currency;
          token.role = membership.role;
          token.membershipId = membership.id;
        }
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      session.organizationId = token.organizationId as string;
      session.organizationName = token.organizationName as string;
      session.organizationSlug = token.organizationSlug as string;
      session.currency = token.currency as string;
      session.role = token.role as typeof session.role;
      session.membershipId = token.membershipId as string;
      return session;
    }
  }
});
