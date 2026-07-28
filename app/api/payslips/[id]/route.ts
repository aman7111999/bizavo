import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { auth } from "@/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { money } from "@/lib/utils";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.organizationId) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const payslip = await prisma.payslip.findFirst({
    where: {
      id,
      organizationId: session.organizationId,
      ...(!can(session.role, "hr:manage") ? { employee: { userId: session.user.id } } : {})
    },
    include: { employee: true, payrollRun: true, organization: true }
  });
  if (!payslip) return new Response("Not found", { status: 404 });

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(7 / 255, 26 / 255, 92 / 255);
  const blue = rgb(36 / 255, 93 / 255, 1);
  const muted = rgb(0.4, 0.44, 0.5);
  page.drawRectangle({ x: 0, y: 730, width: 595, height: 112, color: navy });
  page.drawText("BIZAVO", { x: 45, y: 800, size: 22, font: bold, color: rgb(1, 1, 1) });
  page.drawText("ONE CONNECTED SYSTEM", { x: 45, y: 782, size: 7, font: bold, color: rgb(0.55, 0.75, 1) });
  page.drawText("PAYSLIP", { x: 450, y: 792, size: 14, font: bold, color: rgb(1, 1, 1) });
  page.drawText(payslip.organization.name, { x: 45, y: 690, size: 18, font: bold, color: navy });
  page.drawText(`${String(payslip.payrollRun.month).padStart(2, "0")}/${payslip.payrollRun.year}`, { x: 45, y: 670, size: 10, font: regular, color: muted });
  const rows = [
    ["Employee", payslip.employee.name],
    ["Employee code", payslip.employee.employeeCode],
    ["Designation", payslip.employee.designation],
    ["Department", payslip.employee.department]
  ];
  let y = 620;
  for (const [label, value] of rows) {
    page.drawText(label, { x: 45, y, size: 9, font: regular, color: muted });
    page.drawText(value, { x: 180, y, size: 10, font: bold, color: navy });
    y -= 26;
  }
  page.drawRectangle({ x: 45, y: 365, width: 505, height: 130, color: rgb(0.97, 0.98, 1) });
  page.drawText("EARNINGS", { x: 65, y: 470, size: 9, font: bold, color: blue });
  page.drawText("Basic salary", { x: 65, y: 438, size: 10, font: regular, color: navy });
  page.drawText(money(payslip.basic), { x: 245, y: 438, size: 10, font: bold, color: navy });
  page.drawText("Allowances", { x: 65, y: 412, size: 10, font: regular, color: navy });
  page.drawText(money(payslip.allowances), { x: 245, y: 412, size: 10, font: bold, color: navy });
  page.drawText("Deductions", { x: 65, y: 386, size: 10, font: regular, color: navy });
  page.drawText(`-${money(payslip.deductions)}`, { x: 245, y: 386, size: 10, font: bold, color: rgb(0.75, 0.15, 0.15) });
  page.drawText("NET PAY", { x: 365, y: 438, size: 9, font: bold, color: muted });
  page.drawText(money(payslip.netPay), { x: 365, y: 405, size: 18, font: bold, color: navy });
  page.drawText("This payslip was generated electronically by Bizavo.", { x: 45, y: 80, size: 8, font: regular, color: muted });
  const bytes = await pdf.save();
  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Response(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${payslip.employee.employeeCode}-${payslip.payrollRun.month}-${payslip.payrollRun.year}.pdf"`
    }
  });
}
