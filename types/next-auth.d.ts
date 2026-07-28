import { DefaultSession } from "next-auth";
import { OrgRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & { id: string };
    organizationId: string;
    organizationName: string;
    organizationSlug: string;
    membershipId: string;
    role: OrgRole;
    currency: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    organizationId?: string;
    organizationName?: string;
    organizationSlug?: string;
    membershipId?: string;
    role?: OrgRole;
    currency?: string;
  }
}
