import NextAuth, { type NextAuthConfig } from "next-auth";

const edgeAuthConfig = {
  pages: { signIn: "/login" },
  providers: []
} satisfies NextAuthConfig;

export const { auth: middleware } = NextAuth(edgeAuthConfig);

export const config = {
  matcher: ["/app/:path*"]
};
