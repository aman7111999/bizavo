import { auth } from "@/auth";
import { generateBusinessDocumentPdf } from "@/lib/business-documents";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { organizationCanUseModule } from "@/lib/subscription";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.organizationId || !can(session.role, "documents:view")) return new Response("Unauthorized", { status: 401 });
  const organizationAccess = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { status: true, industry: true }
  });
  if (!organizationAccess || organizationAccess.status !== "ACTIVE" || !(await organizationCanUseModule(session.organizationId, "documents", organizationAccess.industry))) {
    return new Response("Workspace or module unavailable", { status: 403 });
  }
  const { id } = await params;
  const document = await prisma.businessDocument.findFirst({
    where: { id, organizationId: session.organizationId },
    include: {
      organization: { include: { billingProfile: true } },
      project: { select: { name: true, code: true } },
      items: true
    }
  });
  if (!document) return new Response("Not found", { status: 404 });
  const bytes = await generateBusinessDocumentPdf(document);
  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Response(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${document.documentNumber}.pdf"`,
      "Cache-Control": "private, no-store"
    }
  });
}
