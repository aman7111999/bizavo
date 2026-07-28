"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export async function submitWebsiteLead(slug: string, formData: FormData) {
  const organization = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true }
  });
  if (!organization) redirect(`/s/${slug}?error=Company page not found`);
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  if (name.length < 2 || message.length < 5 || (!email && !phone)) {
    redirect(`/s/${slug}?error=${encodeURIComponent("Please enter your name, message and either email or phone.")}#contact`);
  }
  await prisma.lead.create({
    data: {
      organizationId: organization.id,
      name,
      email: email || null,
      phone: phone || null,
      message,
      source: "Public company page"
    }
  });
  redirect(`/s/${slug}?success=1#contact`);
}
