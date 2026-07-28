import Link from "next/link";
import { CalendarCheck2, FileDown, HandCoins, HardHat, UserRoundCheck, UsersRound } from "lucide-react";
import {
  createEmployee,
  createLeaveRequest,
  decideLeaveRequest,
  processPayroll,
  recordEmployeeAttendance,
  recordLaborAttendance
} from "@/app/app/hr/actions";
import { AlertMessage } from "@/components/alert-message";
import { EmptyState } from "@/components/empty-state";
import { FormField } from "@/components/form-field";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { enumLabel, money, number, shortDate } from "@/lib/utils";

export const metadata = { title: "People & HR" };

export default async function HrPage({
  searchParams
}: {
  searchParams: { error?: string; success?: string; view?: string };
}) {
  const session = await requireSession("hr:view");
  const [employees, projects, employeeAttendance, laborAttendance, leaves, payrollRuns] = await Promise.all([
    prisma.employee.findMany({
      where: { organizationId: session.organizationId },
      include: { projectAssignments: { include: { project: { select: { name: true } } }, where: { endDate: null }, take: 1 } },
      orderBy: { name: "asc" }
    }),
    prisma.project.findMany({ where: { organizationId: session.organizationId, status: { in: ["PLANNING", "ACTIVE"] } }, orderBy: { name: "asc" } }),
    prisma.employeeAttendance.findMany({
      where: { organizationId: session.organizationId },
      include: { employee: { select: { name: true, employeeCode: true } }, project: { select: { name: true } } },
      orderBy: { date: "desc" },
      take: 50
    }),
    prisma.laborAttendance.findMany({
      where: { organizationId: session.organizationId },
      include: { project: { select: { name: true, code: true } } },
      orderBy: { date: "desc" },
      take: 50
    }),
    prisma.leaveRequest.findMany({
      where: { organizationId: session.organizationId },
      include: { employee: { select: { name: true, employeeCode: true, annualLeaveBalance: true } } },
      orderBy: { createdAt: "desc" }
    }),
    prisma.payrollRun.findMany({
      where: { organizationId: session.organizationId },
      include: { payslips: { include: { employee: { select: { name: true, employeeCode: true } } } } },
      orderBy: [{ year: "desc" }, { month: "desc" }]
    })
  ]);
  const view = searchParams.view ?? "directory";
  const manage = can(session.role, "hr:manage");
  const monthLabel = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="space-y-7">
      <PageHeader eyebrow="People operations" title="People & HR" description="Employees, project assignments, attendance, site labour, leave and monthly payroll." />
      <AlertMessage error={searchParams.error} success={searchParams.success} />
      <div className="flex flex-wrap gap-2">{[["directory", "Employee directory"], ["attendance", "Attendance"], ["leave", "Leave"], ["payroll", "Payroll"]].map(([value, label]) => <Link key={value} href={`/app/hr?view=${value}`} className={buttonVariants({ variant: view === value ? "default" : "outline", size: "sm" })}>{label}</Link>)}</div>

      {view === "directory" ? (
        <div className="space-y-5">
          <Card><CardHeader><CardTitle>Employee directory</CardTitle></CardHeader><CardContent>{employees.length ? <Table><TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Role</TableHead><TableHead>Department</TableHead><TableHead>Project</TableHead><TableHead>Joined</TableHead><TableHead>Monthly gross</TableHead><TableHead>Leave balance</TableHead></TableRow></TableHeader><TableBody>{employees.map((employee) => <TableRow key={employee.id}><TableCell><p className="font-semibold">{employee.name}</p><p className="text-xs text-muted-foreground">{employee.employeeCode} · {employee.email ?? employee.phone}</p></TableCell><TableCell>{employee.designation}</TableCell><TableCell>{employee.department}</TableCell><TableCell>{employee.projectAssignments[0]?.project.name ?? "Unassigned"}</TableCell><TableCell>{shortDate(employee.joiningDate)}</TableCell><TableCell>{money(Number(employee.monthlyBasic) + Number(employee.monthlyAllowances), session.currency)}</TableCell><TableCell>{number(employee.annualLeaveBalance)} days</TableCell></TableRow>)}</TableBody></Table> : <EmptyState icon={UsersRound} title="No employees" description="Add employees with salary structure and optional project assignments." />}</CardContent></Card>
          {manage ? <Card><CardHeader><CardTitle>Add employee</CardTitle></CardHeader><CardContent><form action={createEmployee} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><FormField label="Full name"><Input name="name" required /></FormField><FormField label="Employee code"><Input name="employeeCode" required /></FormField><FormField label="Designation"><Input name="designation" placeholder="Site Engineer" required /></FormField><FormField label="Department"><Input name="department" placeholder="Projects" required /></FormField><FormField label="Email"><Input name="email" type="email" /></FormField><FormField label="Phone"><Input name="phone" /></FormField><FormField label="Joining date"><Input name="joiningDate" type="date" required /></FormField><FormField label="Assigned project"><Select name="projectId"><option value="">Unassigned</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</Select></FormField><FormField label="Monthly basic"><Input name="monthlyBasic" type="number" min="0" step="0.01" required /></FormField><FormField label="Allowances"><Input name="monthlyAllowances" type="number" min="0" step="0.01" defaultValue="0" /></FormField><FormField label="Default deductions"><Input name="defaultDeductions" type="number" min="0" step="0.01" defaultValue="0" /></FormField><FormField label="Annual leave balance"><Input name="annualLeaveBalance" type="number" min="0" step="0.5" defaultValue="18" /></FormField><div className="sm:col-span-2 lg:col-span-4"><Button type="submit">Add employee</Button></div></form></CardContent></Card> : null}
        </div>
      ) : null}

      {view === "attendance" ? (
        <div className="space-y-5">
          <section className="grid gap-5 xl:grid-cols-2">
            <Card><CardHeader><CardTitle>Employee attendance</CardTitle></CardHeader><CardContent>{employeeAttendance.length ? <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Employee</TableHead><TableHead>Project</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{employeeAttendance.map((row) => <TableRow key={row.id}><TableCell>{shortDate(row.date)}</TableCell><TableCell><p className="font-medium">{row.employee.name}</p><p className="text-xs text-muted-foreground">{row.employee.employeeCode}</p></TableCell><TableCell>{row.project?.name ?? "Office"}</TableCell><TableCell><Badge variant={row.status === "PRESENT" ? "success" : row.status === "ABSENT" ? "destructive" : "warning"}>{enumLabel(row.status)}</Badge></TableCell></TableRow>)}</TableBody></Table> : <EmptyState icon={UserRoundCheck} title="No attendance records" description="Record daily employee presence by project." />}</CardContent></Card>
            <Card><CardHeader><CardTitle>Site labour headcount</CardTitle></CardHeader><CardContent>{laborAttendance.length ? <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Project</TableHead><TableHead>Category</TableHead><TableHead>Present</TableHead><TableHead>Absent</TableHead></TableRow></TableHeader><TableBody>{laborAttendance.map((row) => <TableRow key={row.id}><TableCell>{shortDate(row.date)}</TableCell><TableCell><p className="font-medium">{row.project.name}</p><p className="text-xs text-muted-foreground">{row.project.code}</p></TableCell><TableCell>{row.laborCategory}</TableCell><TableCell className="font-semibold">{row.presentCount}</TableCell><TableCell>{row.absentCount}</TableCell></TableRow>)}</TableBody></Table> : <EmptyState icon={HardHat} title="No labour headcounts" description="Track daily skilled and unskilled site labour by project." />}</CardContent></Card>
          </section>
          {manage ? <section className="grid gap-5 xl:grid-cols-2"><Card><CardHeader><CardTitle>Record employee attendance</CardTitle></CardHeader><CardContent><form action={recordEmployeeAttendance} className="grid gap-4 sm:grid-cols-2"><FormField label="Employee"><Select name="employeeId" required><option value="">Select employee</option>{employees.filter((employee) => employee.active).map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeCode} · {employee.name}</option>)}</Select></FormField><FormField label="Date"><Input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></FormField><FormField label="Project"><Select name="projectId"><option value="">Office / no project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</Select></FormField><FormField label="Status"><Select name="status"><option value="PRESENT">Present</option><option value="ABSENT">Absent</option><option value="HALF_DAY">Half day</option><option value="LEAVE">Leave</option></Select></FormField><FormField label="Notes" className="sm:col-span-2"><Input name="notes" /></FormField><div className="sm:col-span-2"><Button type="submit">Save attendance</Button></div></form></CardContent></Card><Card><CardHeader><CardTitle>Record labour headcount</CardTitle></CardHeader><CardContent><form action={recordLaborAttendance} className="grid gap-4 sm:grid-cols-2"><FormField label="Project"><Select name="projectId" required><option value="">Select project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</Select></FormField><FormField label="Date"><Input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></FormField><FormField label="Labour category"><Input name="laborCategory" placeholder="Masons" required /></FormField><FormField label="Daily rate"><Input name="dailyRate" type="number" min="0" step="0.01" /></FormField><FormField label="Present"><Input name="presentCount" type="number" min="0" defaultValue="0" required /></FormField><FormField label="Absent"><Input name="absentCount" type="number" min="0" defaultValue="0" required /></FormField><FormField label="Notes" className="sm:col-span-2"><Input name="notes" /></FormField><div className="sm:col-span-2"><Button type="submit">Save headcount</Button></div></form></CardContent></Card></section> : null}
        </div>
      ) : null}

      {view === "leave" ? (
        <div className="space-y-5">
          <Card><CardHeader><CardTitle>Leave requests</CardTitle></CardHeader><CardContent>{leaves.length ? <Table><TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Type</TableHead><TableHead>Dates</TableHead><TableHead>Days</TableHead><TableHead>Balance</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader><TableBody>{leaves.map((leave) => <TableRow key={leave.id}><TableCell><p className="font-medium">{leave.employee.name}</p><p className="text-xs text-muted-foreground">{leave.employee.employeeCode}</p></TableCell><TableCell>{leave.type}</TableCell><TableCell>{shortDate(leave.startDate)} – {shortDate(leave.endDate)}</TableCell><TableCell>{number(leave.days)}</TableCell><TableCell>{number(leave.employee.annualLeaveBalance)}</TableCell><TableCell><Badge variant={leave.status === "APPROVED" ? "success" : leave.status === "REJECTED" ? "destructive" : "warning"}>{enumLabel(leave.status)}</Badge></TableCell><TableCell>{manage && leave.status === "PENDING" ? <div className="flex gap-2"><form action={decideLeaveRequest}><input type="hidden" name="leaveId" value={leave.id} /><input type="hidden" name="decision" value="approve" /><Button type="submit" size="sm">Approve</Button></form><form action={decideLeaveRequest}><input type="hidden" name="leaveId" value={leave.id} /><input type="hidden" name="decision" value="reject" /><Button type="submit" size="sm" variant="outline">Reject</Button></form></div> : null}</TableCell></TableRow>)}</TableBody></Table> : <EmptyState icon={CalendarCheck2} title="No leave requests" description="Employee leave requests and approval decisions will appear here." />}</CardContent></Card>
          <Card><CardHeader><CardTitle>Apply for leave</CardTitle></CardHeader><CardContent><form action={createLeaveRequest} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><FormField label="Employee"><Select name="employeeId" required><option value="">Select employee</option>{employees.filter((employee) => employee.active).map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</Select></FormField><FormField label="Leave type"><Select name="type"><option>Annual leave</option><option>Sick leave</option><option>Casual leave</option><option>Unpaid leave</option></Select></FormField><FormField label="Start date"><Input name="startDate" type="date" required /></FormField><FormField label="End date"><Input name="endDate" type="date" required /></FormField><FormField label="Reason" className="sm:col-span-2 lg:col-span-4"><Textarea name="reason" /></FormField><div className="sm:col-span-2 lg:col-span-4"><Button type="submit">Submit request</Button></div></form></CardContent></Card>
        </div>
      ) : null}

      {view === "payroll" ? (
        <div className="space-y-5">
          {manage ? <Card><CardHeader><CardTitle>Process monthly payroll</CardTitle><p className="text-sm text-muted-foreground">Uses each active employee’s salary structure, creates payslips and posts payroll cost to assigned projects.</p></CardHeader><CardContent><form action={processPayroll} className="flex flex-wrap items-end gap-4"><FormField label="Month"><Select name="month" defaultValue={String(new Date().getMonth() + 1)}>{Array.from({ length: 12 }).map((_, index) => <option key={index + 1} value={index + 1}>{new Intl.DateTimeFormat("en-IN", { month: "long" }).format(new Date(2026, index, 1))}</option>)}</Select></FormField><FormField label="Year"><Input name="year" type="number" min="2020" defaultValue={new Date().getFullYear()} required /></FormField><Button type="submit"><HandCoins className="h-4 w-4" />Process payroll</Button></form></CardContent></Card> : null}
          {payrollRuns.length ? payrollRuns.map((run) => <Card key={run.id}><CardHeader className="flex-row items-start justify-between"><div><CardTitle>{monthLabel.format(new Date(run.year, run.month - 1, 1))}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{run.payslips.length} payslips · Processed {shortDate(run.processedAt)}</p></div><Badge variant={run.status === "PAID" ? "success" : "warning"}>{enumLabel(run.status)}</Badge></CardHeader><CardContent><div className="mb-5 grid gap-3 sm:grid-cols-3"><div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-muted-foreground">Gross</p><p className="mt-1 font-semibold">{money(run.totalGross, session.currency)}</p></div><div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-muted-foreground">Deductions</p><p className="mt-1 font-semibold">{money(run.totalDeductions, session.currency)}</p></div><div className="rounded-lg bg-primary/5 p-3"><p className="text-xs text-muted-foreground">Net payroll</p><p className="mt-1 font-semibold text-primary">{money(run.totalNet, session.currency)}</p></div></div><Table><TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Basic</TableHead><TableHead>Allowances</TableHead><TableHead>Deductions</TableHead><TableHead>Net pay</TableHead><TableHead /></TableRow></TableHeader><TableBody>{run.payslips.map((payslip) => <TableRow key={payslip.id}><TableCell><p className="font-medium">{payslip.employee.name}</p><p className="text-xs text-muted-foreground">{payslip.employee.employeeCode}</p></TableCell><TableCell>{money(payslip.basic, session.currency)}</TableCell><TableCell>{money(payslip.allowances, session.currency)}</TableCell><TableCell>{money(payslip.deductions, session.currency)}</TableCell><TableCell className="font-semibold">{money(payslip.netPay, session.currency)}</TableCell><TableCell className="text-right"><Link href={`/api/payslips/${payslip.id}`} target="_blank" className="inline-flex items-center gap-1 text-sm font-semibold text-primary"><FileDown className="h-4 w-4" />PDF</Link></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>) : <EmptyState icon={HandCoins} title="No payroll runs" description="Process a month to generate employee payslips and project labour costs." />}
        </div>
      ) : null}
    </div>
  );
}
