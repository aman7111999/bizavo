import { Industry } from "@prisma/client";

export type ModuleKey =
  | "projects"
  | "procurement"
  | "inventory"
  | "subcontractors"
  | "hr"
  | "finance"
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
    "landing"
  ],
  HOSPITAL: ["hr", "finance", "landing"],
  GYM: ["hr", "finance", "landing"],
  RETAIL: ["procurement", "inventory", "hr", "finance", "landing"],
  PROFESSIONAL_SERVICES: ["projects", "hr", "finance", "landing"],
  MANUFACTURING: ["procurement", "inventory", "hr", "finance", "landing"],
  OTHER: ["projects", "hr", "finance", "landing"]
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
