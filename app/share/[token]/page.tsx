import Link from "next/link";
import { Download, FileCheck2, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { documentTitle, hashShareToken } from "@/lib/business-documents";
import { prisma } from "@/lib/prisma";
import { money, shortDate } from "@/lib/utils";

export const metadata = { title: "Secure document · Bizavo", robots: { index: false, follow: false } };

export default async function SharedDocumentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const share = await prisma.documentShare.findUnique({
    where: { tokenHash: hashShareToken(token) },
    include: {
      organization: { select: { name: true, status: true } },
      document: { include: { items: true, project: { select: { name: true, code: true } } } }
    }
  });
  if (!share || share.expiresAt < new Date() || share.document.status !== "ISSUED" || share.organization.status !== "ACTIVE") notFound();
  const document = share.document;
  return (
    <main className="min-h-screen bg-[#f4f7fb] px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-3xl overflow-hidden rounded-3xl border bg-white shadow-[0_24px_80px_rgba(16,35,80,0.12)]">
        <div className="bg-[#111c35] px-6 py-6 text-white sm:px-10">
          <div className="flex items-center justify-between gap-4">
            <div><p className="text-lg font-bold tracking-tight">Bizavo</p><p className="text-[9px] font-semibold tracking-[0.2em] text-blue-200">ONE CONNECTED SYSTEM</p></div>
            <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs"><ShieldCheck className="h-3.5 w-3.5" />Secure document</div>
          </div>
        </div>
        <div className="p-6 sm:p-10">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div><p className="text-sm font-semibold text-blue-600">{documentTitle(document.type)}</p><h1 className="mt-1 text-2xl font-bold text-slate-950">{document.documentNumber}</h1><p className="mt-2 text-sm text-slate-500">Issued by {share.organization.name}</p></div>
            <Link href={`/api/shared-documents/${token}`} target="_blank" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700"><Download className="h-4 w-4" />View PDF</Link>
          </div>
          <div className="mt-8 grid gap-4 rounded-2xl bg-slate-50 p-5 sm:grid-cols-3">
            <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recipient</p><p className="mt-1 font-semibold text-slate-900">{document.recipientName}</p></div>
            <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Issue date</p><p className="mt-1 font-semibold text-slate-900">{shortDate(document.issueDate)}</p></div>
            <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total</p><p className="mt-1 font-semibold text-slate-900">{money(document.totalAmount, document.currency)}</p></div>
          </div>
          <div className="mt-8 space-y-3">
            {document.items.map((item) => <div key={item.id} className="flex items-start justify-between gap-4 border-b pb-3 text-sm"><div><p className="font-medium text-slate-900">{item.description}</p><p className="mt-1 text-xs text-slate-500">{Number(item.quantity).toLocaleString("en-IN")} {item.unit}</p></div><p className="font-semibold text-slate-900">{money(item.lineTotal, document.currency)}</p></div>)}
          </div>
          <div className="mt-8 flex items-center gap-2 text-xs text-slate-500"><FileCheck2 className="h-4 w-4 text-emerald-600" />This link expires on {shortDate(share.expiresAt)}. Contact the issuing organization if any detail is incorrect.</div>
        </div>
      </div>
    </main>
  );
}
