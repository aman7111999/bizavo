import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type TransactionClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export async function nextEntryNumber(tx: TransactionClient, organizationId: string) {
  const count = await tx.journalEntry.count({ where: { organizationId } });
  return `JE-${new Date().getFullYear()}-${String(count + 1).padStart(5, "0")}`;
}

export async function accountIds(
  tx: TransactionClient,
  organizationId: string,
  codes: string[]
) {
  const accounts = await tx.chartAccount.findMany({
    where: { organizationId, code: { in: codes } },
    select: { id: true, code: true }
  });
  const map = new Map(accounts.map((account) => [account.code, account.id]));
  for (const code of codes) {
    if (!map.has(code)) throw new Error(`System account ${code} is not configured.`);
  }
  return map;
}

export async function postJournal(
  tx: TransactionClient,
  input: {
    organizationId: string;
    entryDate: Date;
    description: string;
    source: Prisma.JournalEntryCreateInput["source"];
    sourceId?: string;
    lines: { accountId: string; projectId?: string; description?: string; debit?: number; credit?: number }[];
  }
) {
  const debit = input.lines.reduce((sum, line) => sum + (line.debit ?? 0), 0);
  const credit = input.lines.reduce((sum, line) => sum + (line.credit ?? 0), 0);
  if (Math.abs(debit - credit) > 0.01) throw new Error("Journal entry is not balanced.");
  return tx.journalEntry.create({
    data: {
      organizationId: input.organizationId,
      entryNumber: await nextEntryNumber(tx, input.organizationId),
      entryDate: input.entryDate,
      description: input.description,
      source: input.source,
      sourceId: input.sourceId,
      lines: {
        create: input.lines.map((line) => ({
          accountId: line.accountId,
          projectId: line.projectId,
          description: line.description,
          debit: line.debit ?? 0,
          credit: line.credit ?? 0
        }))
      }
    }
  });
}

export async function ensureSystemAccounts(organizationId: string) {
  const systemAccounts = [
    ["1000", "Cash and bank", "ASSET"],
    ["1100", "Accounts receivable", "ASSET"],
    ["1300", "Inventory asset", "ASSET"],
    ["1400", "Input tax credit", "ASSET"],
    ["2000", "Accounts payable", "LIABILITY"],
    ["2100", "Payroll payable", "LIABILITY"],
    ["2200", "Output tax payable", "LIABILITY"],
    ["3000", "Owner's equity", "EQUITY"],
    ["4000", "Construction revenue", "REVENUE"],
    ["5000", "Direct material cost", "EXPENSE"],
    ["5100", "Subcontractor cost", "EXPENSE"],
    ["5200", "Direct labour cost", "EXPENSE"],
    ["5300", "Site operating expenses", "EXPENSE"],
    ["6000", "Administrative expenses", "EXPENSE"]
  ] as const;
  await prisma.$transaction(
    systemAccounts.map(([code, name, type]) =>
      prisma.chartAccount.upsert({
        where: { organizationId_code: { organizationId, code } },
        update: { name, type },
        create: { organizationId, code, name, type, system: true }
      })
    )
  );
}
