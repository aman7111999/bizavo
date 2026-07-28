import { describe, expect, it } from "vitest";
import { enumLabel, slugify } from "@/lib/utils";

describe("display helpers", () => {
  it("formats enum labels for product UI", () => {
    expect(enumLabel("PARTIALLY_RECEIVED")).toBe("Partially Received");
  });

  it("creates stable organization slugs", () => {
    expect(slugify("Apex Buildcon Pvt. Ltd.")).toBe("apex-buildcon-pvt-ltd");
  });
});
