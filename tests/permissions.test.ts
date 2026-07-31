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
    expect(can("SITE_ENGINEER", "finance:view")).toBe(false);
  });

  it("keeps employee salary records out of project and accounting roles", () => {
    expect(can("PROJECT_MANAGER", "hr:view")).toBe(false);
    expect(can("ACCOUNTANT", "hr:view")).toBe(false);
    expect(can("HR", "hr:manage")).toBe(true);
    expect(can("SITE_ENGINEER", "hr:view")).toBe(true);
    expect(can("SITE_ENGINEER", "hr:manage")).toBe(false);
  });

  it("keeps viewers read only", () => {
    expect(can("VIEWER", "projects:view")).toBe(true);
    expect(can("VIEWER", "projects:manage")).toBe(false);
    expect(can("VIEWER", "inventory:manage")).toBe(false);
  });

  it("keeps customer document delivery with finance operators", () => {
    expect(can("ACCOUNTANT", "documents:manage")).toBe(true);
    expect(can("PROJECT_MANAGER", "documents:view")).toBe(true);
    expect(can("PROJECT_MANAGER", "documents:manage")).toBe(false);
    expect(can("SITE_ENGINEER", "documents:view")).toBe(false);
  });

  it("separates subscription visibility from billing control", () => {
    expect(can("OWNER", "subscription:manage")).toBe(true);
    expect(can("ADMIN", "subscription:view")).toBe(true);
    expect(can("ADMIN", "subscription:manage")).toBe(false);
    expect(can("ACCOUNTANT", "subscription:view")).toBe(true);
    expect(can("VIEWER", "subscription:view")).toBe(false);
  });
});
