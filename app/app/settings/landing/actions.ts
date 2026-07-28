"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, optionalText, text } from "@/lib/action-utils";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function updateLandingPage(formData: FormData) {
  const session = await requireSession("landing:manage");
  const heroTitle = text(formData, "heroTitle");
  const heroSubtitle = text(formData, "heroSubtitle");
  if (!heroTitle || !heroSubtitle) fail("/app/settings/landing", "Hero title and subtitle are required.");
  const services = text(formData, "services").split("\n").map((service) => service.trim()).filter(Boolean).slice(0, 8);
  const projectIds = formData.getAll("showcaseProjectIds").map(String);
  const validProjects = await prisma.project.findMany({
    where: { organizationId: session.organizationId, id: { in: projectIds } },
    select: { id: true }
  });
  await prisma.landingPage.upsert({
    where: { organizationId: session.organizationId },
    update: {
      heroTitle,
      heroSubtitle,
      aboutTitle: text(formData, "aboutTitle"),
      aboutBody: text(formData, "aboutBody"),
      services,
      showcaseProjectIds: validProjects.map((project) => project.id),
      contactEmail: optionalText(formData, "contactEmail"),
      contactPhone: optionalText(formData, "contactPhone"),
      primaryColor: text(formData, "primaryColor") || "#245DFF",
      published: formData.get("published") === "on"
    },
    create: {
      organizationId: session.organizationId,
      heroTitle,
      heroSubtitle,
      aboutTitle: text(formData, "aboutTitle"),
      aboutBody: text(formData, "aboutBody"),
      services,
      showcaseProjectIds: validProjects.map((project) => project.id),
      contactEmail: optionalText(formData, "contactEmail"),
      contactPhone: optionalText(formData, "contactPhone"),
      primaryColor: text(formData, "primaryColor") || "#245DFF",
      published: formData.get("published") === "on"
    }
  });
  revalidatePath("/app/settings/landing");
  revalidatePath(`/s/${session.organizationSlug}`);
  ok("/app/settings/landing", "Public page updated.");
}
