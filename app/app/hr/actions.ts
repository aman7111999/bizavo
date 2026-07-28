"use server";

import { differenceInCalendarDays } from "date-fns";
import { AttendanceStatus, LeaveStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { accountIds, postJournal } from "@/lib/accounting";
import { dateValue, fail, numberValue, ok, optionalText, text } from "@/lib/action-utils";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function createEmployee(formData: FormData) {
  const session = await requireSession("hr:manage");
  if (!text(formData, "name") || !text(formData, "employeeCode") || !text(formData, "designation") || !text(formData, "department")) {
    fail("/app/hr?view=directory", "Name, employee code, designation and department are required.");
  }
  const monthlyBasic = Math.max(0, numberValue(formData, "monthlyBasic"));
  const monthlyAllowances = Math.max(0, numberValue(formData, "monthlyAllowances"));
  const defaultDeductions = Math.max(0, numberValue(formData, "defaultDeductions"));
  if (defaultDeductions > monthlyBasic + monthlyAllowances) {
    fail("/app/hr?view=directory", "Default deductions cannot exceed monthly gross pay.");
  }
  const email = optionalText(formData, "email")?.toLowerCase();
  const linkedMembership = email
    ? await prisma.membership.findFirst({
        where: { organizationId: session.organizationId, user: { email } },
        select: { userId: true }
      })
    : null;
  if (linkedMembership) {
    const linkedEmployee = await prisma.employee.findUnique({
      where: { userId: linkedMembership.userId },
      select: { id: true }
    });
    if (linkedEmployee) fail("/app/hr?view=directory", "That member account is already linked to an employee.");
  }
  const employee = await prisma.employee.create({
    data: {
      organizationId: session.organizationId,
      employeeCode: text(formData, "employeeCode").toUpperCase(),
      name: text(formData, "name"),
      email,
      userId: linkedMembership?.userId,
      phone: optionalText(formData, "phone"),
      designation: text(formData, "designation"),
      department: text(formData, "department"),
      joiningDate: dateValue(formData, "joiningDate") ?? new Date(),
      monthlyBasic,
      monthlyAllowances,
      defaultDeductions,
      annualLeaveBalance: Math.max(0, numberValue(formData, "annualLeaveBalance") || 18)
    }
  });
  const projectId = optionalText(formData, "projectId");
  if (projectId) {
    const project = await prisma.project.findFirst({ where: { id: projectId, organizationId: session.organizationId } });
    if (project) {
      await prisma.employeeProjectAssignment.create({
        data: { employeeId: employee.id, projectId, startDate: employee.joiningDate, allocation: 100 }
      });
    }
  }
  revalidatePath("/app/hr");
  ok("/app/hr?view=directory", "Employee added.");
}

export async function recordEmployeeAttendance(formData: FormData) {
  const session = await requireSession("hr:manage");
  const employeeId = text(formData, "employeeId");
  const employee = await prisma.employee.findFirst({ where: { id: employeeId, organizationId: session.organizationId, active: true } });
  const date = dateValue(formData, "date");
  const projectId = optionalText(formData, "projectId");
  const statusValue = text(formData, "status");
  const validStatus = Object.values(AttendanceStatus).includes(statusValue as AttendanceStatus);
  const project = projectId
    ? await prisma.project.findFirst({ where: { id: projectId, organizationId: session.organizationId } })
    : null;
  if (!employee || !date || !validStatus || (projectId && !project)) {
    fail("/app/hr?view=attendance", "Employee, date, status and project must be valid.");
  }
  await prisma.employeeAttendance.upsert({
    where: { employeeId_date: { employeeId, date } },
    update: {
      projectId,
      status: statusValue as AttendanceStatus,
      notes: optionalText(formData, "notes")
    },
    create: {
      organizationId: session.organizationId,
      employeeId,
      projectId,
      date,
      status: statusValue as AttendanceStatus,
      notes: optionalText(formData, "notes")
    }
  });
  revalidatePath("/app/hr");
  ok("/app/hr?view=attendance", "Attendance recorded.");
}

export async function recordLaborAttendance(formData: FormData) {
  const session = await requireSession("hr:manage");
  const projectId = text(formData, "projectId");
  const date = dateValue(formData, "date");
  const category = text(formData, "laborCategory");
  const project = await prisma.project.findFirst({ where: { id: projectId, organizationId: session.organizationId } });
  if (!project || !date || !category) fail("/app/hr?view=attendance", "Project, date and labour category are required.");
  await prisma.laborAttendance.upsert({
    where: { projectId_date_laborCategory: { projectId, date, laborCategory: category } },
    update: {
      presentCount: Math.max(0, numberValue(formData, "presentCount")),
      absentCount: Math.max(0, numberValue(formData, "absentCount")),
      dailyRate: numberValue(formData, "dailyRate") || undefined,
      notes: optionalText(formData, "notes")
    },
    create: {
      organizationId: session.organizationId,
      projectId,
      date,
      laborCategory: category,
      presentCount: Math.max(0, numberValue(formData, "presentCount")),
      absentCount: Math.max(0, numberValue(formData, "absentCount")),
      dailyRate: numberValue(formData, "dailyRate") || undefined,
      notes: optionalText(formData, "notes")
    }
  });
  revalidatePath("/app/hr");
  ok("/app/hr?view=attendance", "Site labour headcount recorded.");
}

export async function createLeaveRequest(formData: FormData) {
  const session = await requireSession("hr:view");
  const employeeId = text(formData, "employeeId");
  const startDate = dateValue(formData, "startDate");
  const endDate = dateValue(formData, "endDate");
  const employee = await prisma.employee.findFirst({ where: { id: employeeId, organizationId: session.organizationId, active: true } });
  if (!employee || !startDate || !endDate || endDate < startDate) fail("/app/hr?view=leave", "Choose a valid employee and leave date range.");
  if (!can(session.role, "hr:manage") && employee.userId !== session.user.id) {
    fail("/app/hr?view=leave", "You can submit leave only for your own linked employee profile.");
  }
  const days = differenceInCalendarDays(endDate, startDate) + 1;
  const leaveType = text(formData, "type") || "Annual leave";
  if (leaveType === "Annual leave" && days > Number(employee.annualLeaveBalance)) {
    fail("/app/hr?view=leave", "This request exceeds the available annual leave balance.");
  }
  await prisma.leaveRequest.create({
    data: {
      organizationId: session.organizationId,
      employeeId,
      startDate,
      endDate,
      days,
      type: leaveType,
      reason: optionalText(formData, "reason")
    }
  });
  revalidatePath("/app/hr");
  ok("/app/hr?view=leave", "Leave request submitted.");
}

export async function decideLeaveRequest(formData: FormData) {
  const session = await requireSession("hr:manage");
  const leaveId = text(formData, "leaveId");
  const status = text(formData, "decision") === "approve" ? LeaveStatus.APPROVED : LeaveStatus.REJECTED;
  const leave = await prisma.leaveRequest.findFirst({
    where: { id: leaveId, organizationId: session.organizationId, status: "PENDING" },
    include: { employee: { select: { annualLeaveBalance: true } } }
  });
  if (!leave) fail("/app/hr?view=leave", "Leave request is no longer pending.");
  if (
    status === "APPROVED" &&
    leave.type === "Annual leave" &&
    Number(leave.employee.annualLeaveBalance) < Number(leave.days)
  ) {
    fail("/app/hr?view=leave", "The employee no longer has enough annual leave balance.");
  }
  await prisma.$transaction(async (tx) => {
    await tx.leaveRequest.update({
      where: { id: leave.id },
      data: { status, decidedById: session.user.id, decidedAt: new Date() }
    });
    if (status === "APPROVED" && leave.type === "Annual leave") {
      await tx.employee.update({
        where: { id: leave.employeeId },
        data: { annualLeaveBalance: { decrement: leave.days } }
      });
    }
  });
  revalidatePath("/app/hr");
  ok("/app/hr?view=leave", status === "APPROVED" ? "Leave approved and balance updated." : "Leave rejected.");
}

export async function processPayroll(formData: FormData) {
  const session = await requireSession("hr:manage");
  const month = numberValue(formData, "month");
  const year = numberValue(formData, "year");
  if (month < 1 || month > 12 || year < 2020) fail("/app/hr?view=payroll", "Choose a valid payroll month.");
  const duplicate = await prisma.payrollRun.findFirst({
    where: { organizationId: session.organizationId, month, year }
  });
  if (duplicate) fail("/app/hr?view=payroll", "Payroll has already been created for that month.");
  const employees = await prisma.employee.findMany({
    where: { organizationId: session.organizationId, active: true },
    include: {
      projectAssignments: {
        where: {
          startDate: { lte: new Date(year, month, 0) },
          OR: [{ endDate: null }, { endDate: { gte: new Date(year, month - 1, 1) } }]
        },
        orderBy: { startDate: "desc" },
        take: 1
      }
    }
  });
  if (!employees.length) fail("/app/hr?view=payroll", "There are no active employees to process.");
  if (employees.some((employee) => Number(employee.defaultDeductions) > Number(employee.monthlyBasic) + Number(employee.monthlyAllowances))) {
    fail("/app/hr?view=payroll", "Fix employee deductions that exceed gross pay before processing payroll.");
  }
  await prisma.$transaction(async (tx) => {
    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;
    const run = await tx.payrollRun.create({
      data: {
        organizationId: session.organizationId,
        month,
        year,
        status: "PROCESSED",
        processedAt: new Date(),
        processedById: session.user.id
      }
    });
    const debitLines: { accountId: string; projectId?: string; description: string; debit: number }[] = [];
    const accounts = await accountIds(tx, session.organizationId, ["2100", "5200", "6000"]);
    for (const employee of employees) {
      const basic = Number(employee.monthlyBasic);
      const allowances = Number(employee.monthlyAllowances);
      const deductions = Number(employee.defaultDeductions);
      const gross = basic + allowances;
      const netPay = gross - deductions;
      const projectId = employee.projectAssignments[0]?.projectId;
      totalGross += gross;
      totalDeductions += deductions;
      totalNet += netPay;
      await tx.payslip.create({
        data: {
          organizationId: session.organizationId,
          payrollRunId: run.id,
          employeeId: employee.id,
          projectId,
          basic,
          allowances,
          deductions,
          gross,
          netPay
        }
      });
      debitLines.push({
        accountId: accounts.get(projectId ? "5200" : "6000")!,
        projectId,
        description: employee.name,
        debit: gross
      });
    }
    await tx.payrollRun.update({
      where: { id: run.id },
      data: { totalGross, totalDeductions, totalNet }
    });
    await postJournal(tx, {
      organizationId: session.organizationId,
      entryDate: new Date(year, month, 0),
      description: `Payroll · ${String(month).padStart(2, "0")}/${year}`,
      source: "PAYROLL",
      sourceId: run.id,
      lines: [
        ...debitLines,
        { accountId: accounts.get("2100")!, description: "Net payroll and deductions payable", credit: totalGross }
      ]
    });
  });
  revalidatePath("/app/hr");
  revalidatePath("/app/finance");
  ok("/app/hr?view=payroll", "Payroll processed and payslips generated.");
}
