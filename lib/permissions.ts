import { OrgRole } from "@prisma/client";

export type Permission =
  | "dashboard:view"
  | "projects:view"
  | "projects:manage"
  | "procurement:view"
  | "procurement:request"
  | "procurement:approve"
  | "inventory:view"
  | "inventory:manage"
  | "subcontractors:view"
  | "subcontractors:manage"
  | "hr:view"
  | "hr:manage"
  | "finance:view"
  | "finance:manage"
  | "documents:view"
  | "documents:manage"
  | "landing:manage"
  | "members:manage"
  | "subscription:view"
  | "subscription:manage";

const all: Permission[] = [
  "dashboard:view",
  "projects:view",
  "projects:manage",
  "procurement:view",
  "procurement:request",
  "procurement:approve",
  "inventory:view",
  "inventory:manage",
  "subcontractors:view",
  "subcontractors:manage",
  "hr:view",
  "hr:manage",
  "finance:view",
  "finance:manage",
  "documents:view",
  "documents:manage",
  "landing:manage",
  "members:manage",
  "subscription:view",
  "subscription:manage"
];

export const rolePermissions: Record<OrgRole, Permission[]> = {
  OWNER: all,
  ADMIN: all.filter((permission) => permission !== "subscription:manage"),
  PROJECT_MANAGER: [
    "dashboard:view",
    "projects:view",
    "projects:manage",
    "procurement:view",
    "procurement:request",
    "inventory:view",
    "subcontractors:view",
    "subcontractors:manage",
    "finance:view",
    "documents:view"
  ],
  SITE_ENGINEER: [
    "dashboard:view",
    "projects:view",
    "procurement:view",
    "procurement:request",
    "inventory:view",
    "inventory:manage",
    "subcontractors:view",
    "hr:view"
  ],
  PROCUREMENT: [
    "dashboard:view",
    "projects:view",
    "procurement:view",
    "procurement:request",
    "procurement:approve",
    "inventory:view",
    "inventory:manage",
    "subcontractors:view",
    "finance:view",
    "documents:view"
  ],
  HR: ["dashboard:view", "projects:view", "hr:view", "hr:manage"],
  ACCOUNTANT: [
    "dashboard:view",
    "projects:view",
    "procurement:view",
    "inventory:view",
    "subcontractors:view",
    "finance:view",
    "finance:manage",
    "documents:view",
    "documents:manage",
    "subscription:view"
  ],
  VIEWER: [
    "dashboard:view",
    "projects:view",
    "procurement:view",
    "inventory:view",
    "subcontractors:view"
  ]
};

export function can(role: OrgRole, permission: Permission) {
  return rolePermissions[role].includes(permission);
}

export const projectRestrictedRoles: OrgRole[] = ["SITE_ENGINEER"];
