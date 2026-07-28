"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { MilestoneStatus, ProjectStatus, TaskStatus } from "@prisma/client";
import { z } from "zod";
import { dateValue, fail, numberValue, ok, optionalText, parseOrFail, text } from "@/lib/action-utils";
import { prisma } from "@/lib/prisma";
import { requireProject, requireSession } from "@/lib/session";
import { getOrganizationPlanLimits } from "@/lib/subscription";
import { slugify } from "@/lib/utils";

const projectSchema = z.object({
  name: z.string().min(3, "Project name must be at least 3 characters."),
  code: z.string().min(2, "Project code is required."),
  clientName: z.string().min(2, "Client name is required."),
  location: z.string().min(2, "Location is required."),
  budget: z.number().positive("Budget must be greater than zero."),
  startDate: z.date(),
  endDate: z.date().optional(),
  status: z.nativeEnum(ProjectStatus)
});

export async function createProject(formData: FormData) {
  const session = await requireSession("projects:manage");
  const payload = parseOrFail(
    projectSchema,
    {
      name: text(formData, "name"),
      code: text(formData, "code").toUpperCase(),
      clientName: text(formData, "clientName"),
      location: text(formData, "location"),
      budget: numberValue(formData, "budget"),
      startDate: dateValue(formData, "startDate"),
      endDate: dateValue(formData, "endDate"),
      status: text(formData, "status")
    },
    "/app/projects/new"
  );
  if (payload.endDate && payload.endDate < payload.startDate) fail("/app/projects/new", "End date cannot be before start date.");
  const [duplicate, limits, projectCount] = await Promise.all([
    prisma.project.findFirst({
      where: { organizationId: session.organizationId, code: payload.code },
      select: { id: true }
    }),
    getOrganizationPlanLimits(session.organizationId),
    prisma.project.count({ where: { organizationId: session.organizationId } })
  ]);
  if (duplicate) fail("/app/projects/new", "That project code is already in use.");
  if (limits && projectCount >= limits.maxProjects) {
    fail("/app/projects/new", `Your plan allows ${limits.maxProjects} projects. Upgrade before creating another project.`);
  }
  const project = await prisma.project.create({
    data: {
      organizationId: session.organizationId,
      ...payload,
      clientEmail: optionalText(formData, "clientEmail"),
      clientPhone: optionalText(formData, "clientPhone"),
      description: optionalText(formData, "description"),
      members: { create: { membershipId: session.membershipId } }
    }
  });
  await prisma.inventoryLocation.create({
    data: {
      organizationId: session.organizationId,
      projectId: project.id,
      name: `${project.name} Site Store`,
      code: `${slugify(project.code).toUpperCase()}-SITE`,
      type: "SITE_STORE",
      address: project.location
    }
  });
  ok(`/app/projects/${project.id}`, "Project created with a linked site store.");
}

export async function createContract(formData: FormData) {
  const projectId = text(formData, "projectId");
  const { session } = await requireProject(projectId, "projects:manage");
  const contractValue = numberValue(formData, "contractValue");
  if (!text(formData, "contractNumber") || contractValue <= 0) fail(`/app/projects/${projectId}`, "Contract number and value are required.");
  await prisma.projectContract.create({
    data: {
      organizationId: session.organizationId,
      projectId,
      contractNumber: text(formData, "contractNumber"),
      contractValue,
      paymentTerms: text(formData, "paymentTerms") || "Milestone based",
      signedAt: dateValue(formData, "signedAt")
    }
  });
  revalidatePath(`/app/projects/${projectId}`);
  ok(`/app/projects/${projectId}`, "Contract added.");
}

export async function createMilestone(formData: FormData) {
  const projectId = text(formData, "projectId");
  const { session } = await requireProject(projectId, "projects:manage");
  const contractId = text(formData, "contractId");
  const contract = await prisma.projectContract.findFirst({
    where: { id: contractId, projectId, organizationId: session.organizationId }
  });
  if (!contract) fail(`/app/projects/${projectId}`, "Select a valid contract.");
  const billingPercent = numberValue(formData, "billingPercent");
  if (!text(formData, "name") || billingPercent <= 0 || billingPercent > 100) {
    fail(`/app/projects/${projectId}`, "Milestone name and a billing percentage between 0 and 100 are required.");
  }
  const existing = await prisma.contractMilestone.aggregate({
    where: { contractId },
    _sum: { billingPercent: true }
  });
  if (Number(existing._sum.billingPercent ?? 0) + billingPercent > 100.001) {
    fail(`/app/projects/${projectId}`, "Milestone billing percentages cannot exceed 100% of the contract.");
  }
  await prisma.contractMilestone.create({
    data: {
      organizationId: session.organizationId,
      projectId,
      contractId,
      name: text(formData, "name"),
      description: optionalText(formData, "description"),
      dueDate: dateValue(formData, "dueDate"),
      billingPercent,
      billingAmount: Number(contract.contractValue) * (billingPercent / 100)
    }
  });
  revalidatePath(`/app/projects/${projectId}`);
  ok(`/app/projects/${projectId}`, "Milestone added.");
}

export async function updateMilestone(formData: FormData) {
  const projectId = text(formData, "projectId");
  const milestoneId = text(formData, "milestoneId");
  const { session } = await requireProject(projectId, "projects:manage");
  const milestone = await prisma.contractMilestone.findFirst({
    where: { id: milestoneId, projectId, organizationId: session.organizationId },
    include: { invoices: { select: { id: true } } }
  });
  if (!milestone) fail(`/app/projects/${projectId}`, "Milestone not found.");
  const completion = Math.min(100, Math.max(0, numberValue(formData, "completion")));
  const statusValue = text(formData, "status");
  if (!Object.values(MilestoneStatus).includes(statusValue as MilestoneStatus)) {
    fail(`/app/projects/${projectId}`, "Select a valid milestone status.");
  }
  const requestedStatus = statusValue as MilestoneStatus;
  const status = completion === 100 ? MilestoneStatus.COMPLETED : requestedStatus;

  await prisma.$transaction(async (tx) => {
    await tx.contractMilestone.update({
      where: { id: milestoneId },
      data: {
        completionPercent: completion,
        status,
        completedAt: status === "COMPLETED" ? new Date() : null
      }
    });
    if (status === "COMPLETED" && milestone.invoices.length === 0) {
      const count = await tx.clientInvoice.count({ where: { organizationId: session.organizationId } });
      await tx.clientInvoice.create({
        data: {
          organizationId: session.organizationId,
          projectId,
          milestoneId,
          invoiceNumber: `INV-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`,
          issueDate: new Date(),
          dueDate: new Date(Date.now() + 30 * 86_400_000),
          subtotal: milestone.billingAmount,
          taxAmount: 0,
          totalAmount: milestone.billingAmount,
          status: "DRAFT",
          notes: `Automatically created when milestone “${milestone.name}” reached 100%.`
        }
      });
    }
  });
  revalidatePath(`/app/projects/${projectId}`);
  revalidatePath("/app/finance");
  ok(`/app/projects/${projectId}`, status === "COMPLETED" ? "Milestone completed and a draft client invoice was created." : "Milestone updated.");
}

export async function createPhase(formData: FormData) {
  const projectId = text(formData, "projectId");
  const { session } = await requireProject(projectId, "projects:manage");
  if (!text(formData, "name")) fail(`/app/projects/${projectId}`, "Phase name is required.");
  const milestoneId = optionalText(formData, "milestoneId");
  if (milestoneId) {
    const milestone = await prisma.contractMilestone.findFirst({
      where: { id: milestoneId, projectId, organizationId: session.organizationId },
      select: { id: true }
    });
    if (!milestone) fail(`/app/projects/${projectId}`, "Select a milestone belonging to this project.");
  }
  const startDate = dateValue(formData, "startDate");
  const endDate = dateValue(formData, "endDate");
  if (startDate && endDate && endDate < startDate) {
    fail(`/app/projects/${projectId}`, "Phase end date cannot be before its start date.");
  }
  await prisma.projectPhase.create({
    data: {
      organizationId: session.organizationId,
      projectId,
      milestoneId,
      name: text(formData, "name"),
      description: optionalText(formData, "description"),
      startDate,
      endDate,
      assignee: optionalText(formData, "assignee")
    }
  });
  revalidatePath(`/app/projects/${projectId}`);
  ok(`/app/projects/${projectId}`, "Project phase added.");
}

export async function updatePhase(formData: FormData) {
  const projectId = text(formData, "projectId");
  const { session } = await requireProject(projectId, "projects:manage");
  const phase = await prisma.projectPhase.findFirst({
    where: { id: text(formData, "phaseId"), projectId, organizationId: session.organizationId }
  });
  if (!phase) fail(`/app/projects/${projectId}`, "Phase not found.");
  const completion = Math.min(100, Math.max(0, numberValue(formData, "completion")));
  const statusValue = text(formData, "status");
  if (!Object.values(TaskStatus).includes(statusValue as TaskStatus)) {
    fail(`/app/projects/${projectId}`, "Select a valid phase status.");
  }
  await prisma.projectPhase.update({
    where: { id: phase.id },
    data: {
      completion,
      status: completion === 100 ? TaskStatus.COMPLETED : statusValue as TaskStatus
    }
  });
  revalidatePath(`/app/projects/${projectId}`);
  ok(`/app/projects/${projectId}`, "Phase progress updated.");
}

export async function uploadProjectDocument(formData: FormData) {
  const projectId = text(formData, "projectId");
  const { session } = await requireProject(projectId, "projects:manage");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) fail(`/app/projects/${projectId}`, "Choose a file to upload.");
  if (file.size > 8 * 1024 * 1024) fail(`/app/projects/${projectId}`, "Files must be smaller than 8 MB.");
  const extension = file.name.toLowerCase().split(".").pop() ?? "";
  const allowedExtensions = new Set(["pdf", "png", "jpg", "jpeg", "webp", "doc", "docx", "xls", "xlsx", "dwg", "dxf"]);
  if (!allowedExtensions.has(extension)) {
    fail(`/app/projects/${projectId}`, "Use PDF, image, Word, Excel, DWG or DXF project files.");
  }
  const [limits, documentUsage] = await Promise.all([
    getOrganizationPlanLimits(session.organizationId),
    prisma.projectDocument.aggregate({
      where: { organizationId: session.organizationId },
      _sum: { sizeBytes: true }
    })
  ]);
  if (limits && (documentUsage._sum.sizeBytes ?? 0) + file.size > limits.maxStorageMb * 1024 * 1024) {
    fail(`/app/projects/${projectId}`, `This upload exceeds your ${limits.maxStorageMb} MB document storage limit.`);
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "project-documents";
  if (!supabaseUrl || !serviceKey) fail(`/app/projects/${projectId}`, "Document storage is not configured.");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const storagePath = `${session.organizationId}/${projectId}/${crypto.randomUUID()}-${safeName}`;
  const client = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { error } = await client.storage.from(bucket).upload(storagePath, await file.arrayBuffer(), {
    contentType: file.type || "application/octet-stream",
    upsert: false
  });
  if (error) fail(`/app/projects/${projectId}`, `Upload failed: ${error.message}`);
  try {
    await prisma.projectDocument.create({
      data: {
        organizationId: session.organizationId,
        projectId,
        name: text(formData, "name") || file.name,
        category: text(formData, "category") || "Other",
        storagePath,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        uploadedById: session.user.id
      }
    });
  } catch (databaseError) {
    await client.storage.from(bucket).remove([storagePath]);
    throw databaseError;
  }
  revalidatePath(`/app/projects/${projectId}`);
  ok(`/app/projects/${projectId}`, "Document uploaded.");
}
