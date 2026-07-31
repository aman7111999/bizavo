import { generateBusinessDocumentPdf, hashShareToken } from "@/lib/business-documents";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const share = await prisma.documentShare.findUnique({
    where: { tokenHash: hashShareToken(token) },
    include: {
      document: {
        include: {
          organization: { include: { billingProfile: true } },
          project: { select: { name: true, code: true } },
          items: true
        }
      }
    }
  });
  if (!share || share.expiresAt < new Date() || share.document.status !== "ISSUED" || share.document.organization.status !== "ACTIVE") {
    return new Response("This secure document link is invalid or has expired.", { status: 410 });
  }
  const bytes = await generateBusinessDocumentPdf(share.document);
  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Response(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${share.document.documentNumber}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow"
    }
  });
}
