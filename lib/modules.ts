import { Industry } from "@prisma/client";

export type ModuleKey =
  | "projects"
  | "procurement"
  | "inventory"
  | "subcontractors"
  | "hr"
  | "finance"
  | "documents"
  | "landing"
  | "equipment"
  | "safety"
  | "boq"
  | "tenders"
  | "client_portal";

export const industryModules: Record<Industry, ModuleKey[]> = {
  CONSTRUCTION: [
    "projects",
    "procurement",
    "inventory",
    "subcontractors",
    "hr",
    "finance",
    "documents",
    "landing"
  ],
  HOSPITAL: ["hr", "finance", "documents", "landing"],
  GYM: ["hr", "finance", "documents", "landing"],
  RETAIL: ["procurement", "inventory", "hr", "finance", "documents", "landing"],
  PROFESSIONAL_SERVICES: ["projects", "hr", "finance", "documents", "landing"],
  MANUFACTURING: ["procurement", "inventory", "hr", "finance", "documents", "landing"],
  OTHER: ["projects", "hr", "finance", "documents", "landing"]
};

export const futureConstructionModules: {
  key: ModuleKey;
  route: string;
  dataBoundary: string;
}[] = [
  { key: "equipment", route: "/app/equipment", dataBoundary: "organizationId + optional projectId" },
  { key: "safety", route: "/app/safety", dataBoundary: "organizationId + projectId" },
  { key: "boq", route: "/app/estimating", dataBoundary: "organizationId + projectId + revision" },
  { key: "tenders", route: "/app/tenders", dataBoundary: "organizationId + projectId + subcontractorId" },
  { key: "client_portal", route: "/portal/[organizationSlug]/[projectId]", dataBoundary: "organizationId + projectId + client identity" }
];
