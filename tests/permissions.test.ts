import { describe, expect, it } from "vitest";
import { can } from "@/lib/permissions";

describe("role permissions", () => {
  it("keeps finance mutation with Accountant, Admin and Owner", () => {
    expect(can("ACCOUNTANT", "finance:manage")).toBe(true);
    expect(can("ADMIN", "finance:manage")).toBe(true);
    expect(can("OWNER", "finance:manage")).toBe(true);
    expect(can("PROJECT_MANAGER", "finance:manage")).toBe(false);
  });

  it("allows site engineers to post material movements but not approve POs", () => {
    expect(can("SITE_ENGINEER", "inventory:manage")).toBe(true);
    expect(can("SITE_ENGINEER", "procurement:approve")).toBe(false);
  });

  it("keeps viewers read only", () => {
    expect(can("VIEWER", "projects:view")).toBe(true);
    expect(can("VIEWER", "projects:manage")).toBe(false);
    expect(can("VIEWER", "inventory:manage")).toBe(false);
  });
});
