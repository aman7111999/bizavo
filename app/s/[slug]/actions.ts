"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const leadSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200).or(z.literal("")),
  phone: z.string().trim().max(40),
  message: z.string().trim().min(5).max(4000)
}).refine((value) => value.email || value.phone, {
  message: "Email or phone is required."
});

export async function submitWebsiteLead(slug: string, formData: FormData) {
  const organization = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true }
  });
  if (!organization) redirect(`/s/${slug}?error=Company page not found`);
  if (String(formData.get("website") ?? "").trim()) redirect(`/s/${slug}?success=1#contact`);
  const parsed = leadSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    message: String(formData.get("message") ?? "")
  });
  if (!parsed.success) {
    redirect(`/s/${slug}?error=${encodeURIComponent("Please enter your name, message and either email or phone.")}#contact`);
  }
  const { name, email, phone, message } = parsed.data;
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
