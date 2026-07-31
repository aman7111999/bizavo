import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { createDocumentNumber } from "../lib/business-documents";

const prisma = new PrismaClient();

const d = (value: string) => new Date(`${value}T00:00:00.000Z`);

const allCoreModules = ["projects", "procurement", "inventory", "subcontractors", "hr", "finance", "documents", "landing"];

async function seedSubscriptionPlans() {
  await prisma.subscriptionPlan.upsert({
    where: { code: "STARTER" },
    update: {
      name: "Starter",
      description: "Core project and purchasing controls for a growing contractor.",
      monthlyPrice: 4999,
      annualPrice: 49990,
      maxUsers: 10,
      maxProjects: 5,
      maxStorageMb: 5120,
      modules: ["projects", "procurement", "inventory", "documents", "landing"],
      active: true,
      isDefault: true
    },
    create: {
      code: "STARTER",
      name: "Starter",
      description: "Core project and purchasing controls for a growing contractor.",
      monthlyPrice: 4999,
      annualPrice: 49990,
      maxUsers: 10,
      maxProjects: 5,
      maxStorageMb: 5120,
      modules: ["projects", "procurement", "inventory", "documents", "landing"],
      active: true,
      isDefault: true
    }
  });
  const growth = await prisma.subscriptionPlan.upsert({
    where: { code: "GROWTH" },
    update: {
      name: "Growth",
      description: "Full construction operations for multi-project teams.",
      monthlyPrice: 12999,
      annualPrice: 129990,
      maxUsers: 40,
      maxProjects: 25,
      maxStorageMb: 25600,
      modules: allCoreModules,
      active: true
    },
    create: {
      code: "GROWTH",
      name: "Growth",
      description: "Full construction operations for multi-project teams.",
      monthlyPrice: 12999,
      annualPrice: 129990,
      maxUsers: 40,
      maxProjects: 25,
      maxStorageMb: 25600,
      modules: allCoreModules,
      active: true
    }
  });
  await prisma.subscriptionPlan.upsert({
    where: { code: "ENTERPRISE" },
    update: {
      name: "Enterprise",
      description: "Unlimited construction operations with controlled custom terms.",
      monthlyPrice: 29999,
      annualPrice: 299990,
      trialDays: 30,
      maxUsers: 250,
      maxProjects: 250,
      maxStorageMb: 102400,
      modules: allCoreModules,
      active: true
    },
    create: {
      code: "ENTERPRISE",
      name: "Enterprise",
      description: "Unlimited construction operations with controlled custom terms.",
      monthlyPrice: 29999,
      annualPrice: 299990,
      trialDays: 30,
      maxUsers: 250,
      maxProjects: 250,
      maxStorageMb: 102400,
      modules: allCoreModules,
      active: true
    }
  });
  return growth;
}

async function ensureDemoSubscription(organizationId: string, ownerId: string, growthPlanId: string) {
  const subscription = await prisma.organizationSubscription.upsert({
    where: { organizationId },
    update: {},
    create: {
      organizationId,
      planId: growthPlanId,
      status: "ACTIVE",
      billingCycle: "ANNUAL",
      startedAt: d("2026-07-01"),
      currentPeriodStart: d("2026-07-01"),
      currentPeriodEnd: d("2027-06-30")
    }
  });
  await prisma.organizationBillingProfile.upsert({
    where: { organizationId },
    update: {},
    create: {
      organizationId,
      legalName: "Apex Buildcon",
      billingEmail: "owner@demo.bizavo.in",
      billingPhone: "+91 22 4000 8800",
      taxId: "27AABCA1234A1Z5",
      city: "Mumbai",
      state: "Maharashtra",
      country: "India"
    }
  });
  const invoice = await prisma.subscriptionInvoice.upsert({
    where: { invoiceNumber: "BIZ-2026-0001" },
    update: {},
    create: {
      organizationId,
      subscriptionId: subscription.id,
      invoiceNumber: "BIZ-2026-0001",
      issueDate: d("2026-07-01"),
      dueDate: d("2026-07-10"),
      subtotal: 129990,
      taxAmount: 23398.2,
      totalAmount: 153388.2,
      paidAmount: 153388.2,
      status: "PAID",
      notes: "Growth annual subscription"
    }
  });
  const payment = await prisma.subscriptionPayment.findFirst({
    where: { invoiceId: invoice.id, reference: "DEMO-SUBSCRIPTION-2026" }
  });
  if (!payment) {
    await prisma.subscriptionPayment.create({
      data: {
        organizationId,
        invoiceId: invoice.id,
        paymentDate: d("2026-07-03"),
        amount: 153388.2,
        method: "Bank transfer",
        reference: "DEMO-SUBSCRIPTION-2026",
        notes: "Seeded demonstration payment",
        recordedById: ownerId
      }
    });
  }
}

async function ensureDemoPaymentReceipts(organizationId: string, ownerId: string, currency = "INR") {
  const payments = await prisma.clientPayment.findMany({
    where: { organizationId },
    include: {
      invoice: {
        include: {
          project: { select: { id: true, clientName: true, clientEmail: true, clientPhone: true, location: true } }
        }
      }
    }
  });
  for (const payment of payments) {
    await prisma.businessDocument.upsert({
      where: { clientPaymentId: payment.id },
      update: {},
      create: {
        organizationId,
        projectId: payment.invoice.projectId,
        clientPaymentId: payment.id,
        type: "PAYMENT_RECEIPT",
        status: "ISSUED",
        documentNumber: createDocumentNumber("PAYMENT_RECEIPT", payment.id, payment.paymentDate),
        recipientName: payment.invoice.project.clientName,
        recipientEmail: payment.invoice.project.clientEmail,
        recipientPhone: payment.invoice.project.clientPhone,
        billingAddress: payment.invoice.project.location,
        issueDate: payment.paymentDate,
        currency,
        subtotal: payment.amount,
        totalAmount: payment.amount,
        paymentMethod: payment.method,
        paymentReference: payment.reference,
        notes: `Payment received against ${payment.invoice.invoiceNumber}.`,
        createdById: ownerId,
        items: {
          create: {
            description: `Payment received against invoice ${payment.invoice.invoiceNumber}`,
            quantity: 1,
            unit: "payment",
            unitPrice: payment.amount,
            lineTotal: payment.amount
          }
        }
      }
    });
  }
}

async function main() {
  const growthPlan = await seedSubscriptionPlans();
  const existing = await prisma.organization.findUnique({ where: { slug: "apex-buildcon" } });
  if (existing) {
    const [engineer, owner] = await Promise.all([
      prisma.user.findUnique({ where: { email: "engineer@demo.bizavo.in" } }),
      prisma.user.findUnique({ where: { email: "owner@demo.bizavo.in" } })
    ]);
    if (engineer) {
      await prisma.employee.updateMany({
        where: { organizationId: existing.id, employeeCode: "EMP-001", userId: null },
        data: { userId: engineer.id, email: engineer.email }
      });
    }
    if (owner) {
      await ensureDemoSubscription(existing.id, owner.id, growthPlan.id);
      await ensureDemoPaymentReceipts(existing.id, owner.id, existing.currency);
    }
    console.log("Demo organization already exists; seed skipped.");
    return;
  }

  const passwordHash = await hash("Bizavo@2026", 12);
  const [owner, accountant, engineer, procurementUser, hrUser] = await Promise.all([
    prisma.user.upsert({
      where: { email: "owner@demo.bizavo.in" },
      update: { name: "Arjun Mehta", passwordHash },
      create: { name: "Arjun Mehta", email: "owner@demo.bizavo.in", passwordHash }
    }),
    prisma.user.upsert({
      where: { email: "accounts@demo.bizavo.in" },
      update: { name: "Neha Shah", passwordHash },
      create: { name: "Neha Shah", email: "accounts@demo.bizavo.in", passwordHash }
    }),
    prisma.user.upsert({
      where: { email: "engineer@demo.bizavo.in" },
      update: { name: "Rohit Kulkarni", passwordHash },
      create: { name: "Rohit Kulkarni", email: "engineer@demo.bizavo.in", passwordHash }
    }),
    prisma.user.upsert({
      where: { email: "procurement@demo.bizavo.in" },
      update: { name: "Ishita Rao", passwordHash },
      create: { name: "Ishita Rao", email: "procurement@demo.bizavo.in", passwordHash }
    }),
    prisma.user.upsert({
      where: { email: "hr@demo.bizavo.in" },
      update: { name: "Karan Singh", passwordHash },
      create: { name: "Karan Singh", email: "hr@demo.bizavo.in", passwordHash }
    })
  ]);

  const organization = await prisma.organization.create({
    data: {
      name: "Apex Buildcon",
      slug: "apex-buildcon",
      industry: "CONSTRUCTION",
      currency: "INR",
      timezone: "Asia/Kolkata",
      memberships: {
        create: [
          { userId: owner.id, role: "OWNER" },
          { userId: accountant.id, role: "ACCOUNTANT" },
          { userId: engineer.id, role: "SITE_ENGINEER" },
          { userId: procurementUser.id, role: "PROCUREMENT" },
          { userId: hrUser.id, role: "HR" }
        ]
      }
    },
    include: { memberships: true }
  });
  const ownerMembership = organization.memberships.find((membership) => membership.userId === owner.id)!;
  const engineerMembership = organization.memberships.find((membership) => membership.userId === engineer.id)!;
  await ensureDemoSubscription(organization.id, owner.id, growthPlan.id);

  const accountSeed = [
    ["1000", "Cash and bank", "ASSET"], ["1100", "Accounts receivable", "ASSET"], ["1300", "Inventory asset", "ASSET"],
    ["1400", "Input tax credit", "ASSET"], ["2000", "Accounts payable", "LIABILITY"], ["2100", "Payroll payable", "LIABILITY"],
    ["2200", "Output tax payable", "LIABILITY"], ["3000", "Owner's equity", "EQUITY"], ["4000", "Construction revenue", "REVENUE"],
    ["5000", "Direct material cost", "EXPENSE"], ["5100", "Subcontractor cost", "EXPENSE"], ["5200", "Direct labour cost", "EXPENSE"],
    ["5300", "Site operating expenses", "EXPENSE"], ["6000", "Administrative expenses", "EXPENSE"]
  ] as const;
  const createdAccounts = await Promise.all(
    accountSeed.map(([code, name, type]) =>
      prisma.chartAccount.create({
        data: { organizationId: organization.id, code, name, type, system: true }
      })
    )
  );
  const accounts = new Map(createdAccounts.map((account) => [account.code, account.id]));
  let journalCounter = 0;
  async function journal(input: {
    date: Date;
    description: string;
    source: "OPENING" | "CLIENT_INVOICE" | "CLIENT_PAYMENT" | "VENDOR_BILL" | "VENDOR_PAYMENT" | "EXPENSE" | "PAYROLL" | "INVENTORY" | "MANUAL";
    sourceId?: string;
    lines: { code: string; projectId?: string; debit?: number; credit?: number; description?: string }[];
  }) {
    journalCounter += 1;
    return prisma.journalEntry.create({
      data: {
        organizationId: organization.id,
        entryNumber: `JE-2026-${String(journalCounter).padStart(5, "0")}`,
        entryDate: input.date,
        description: input.description,
        source: input.source,
        sourceId: input.sourceId,
        lines: {
          create: input.lines.map((line) => ({
            accountId: accounts.get(line.code)!,
            projectId: line.projectId,
            debit: line.debit ?? 0,
            credit: line.credit ?? 0,
            description: line.description
          }))
        }
      }
    });
  }

  const [skyline, orion, riverside] = await Promise.all([
    prisma.project.create({
      data: {
        organizationId: organization.id,
        name: "Skyline Heights",
        code: "SKY-001",
        clientName: "Northstar Realty",
        clientEmail: "projects@northstar.example",
        location: "Powai, Mumbai",
        startDate: d("2025-10-01"),
        endDate: d("2027-03-31"),
        budget: 92000000,
        status: "ACTIVE",
        description: "Two-tower premium residential development with three podium levels.",
        members: { create: [{ membershipId: ownerMembership.id }, { membershipId: engineerMembership.id }] }
      }
    }),
    prisma.project.create({
      data: {
        organizationId: organization.id,
        name: "Orion Technology Park",
        code: "OTP-002",
        clientName: "Vantage Spaces",
        clientEmail: "delivery@vantage.example",
        location: "Airoli, Navi Mumbai",
        startDate: d("2026-01-15"),
        endDate: d("2027-10-30"),
        budget: 164000000,
        status: "ACTIVE",
        description: "Commercial technology campus with two office blocks and shared services.",
        members: { create: { membershipId: ownerMembership.id } }
      }
    }),
    prisma.project.create({
      data: {
        organizationId: organization.id,
        name: "Riverside Villas",
        code: "RSV-003",
        clientName: "Elm Habitat",
        location: "Karjat, Maharashtra",
        startDate: d("2026-09-01"),
        endDate: d("2028-02-28"),
        budget: 68000000,
        status: "PLANNING",
        description: "Low-rise gated villa community currently in pre-construction planning.",
        members: { create: { membershipId: ownerMembership.id } }
      }
    })
  ]);

  const skylineContract = await prisma.projectContract.create({
    data: {
      organizationId: organization.id,
      projectId: skyline.id,
      contractNumber: "NSR/APEX/2025/041",
      contractValue: 118000000,
      paymentTerms: "30 days from certified milestone invoice",
      signedAt: d("2025-09-12")
    }
  });
  const orionContract = await prisma.projectContract.create({
    data: {
      organizationId: organization.id,
      projectId: orion.id,
      contractNumber: "VSP/OTP/GC/2026-07",
      contractValue: 205000000,
      paymentTerms: "21 days from milestone certification",
      signedAt: d("2026-01-04")
    }
  });
  const riversideContract = await prisma.projectContract.create({
    data: {
      organizationId: organization.id,
      projectId: riverside.id,
      contractNumber: "ELM-RSV-LOI-2026",
      contractValue: 84000000,
      paymentTerms: "Milestone based; final contract under review",
      signedAt: d("2026-07-10")
    }
  });

  const skylineMilestones = await Promise.all([
    prisma.contractMilestone.create({ data: { organizationId: organization.id, projectId: skyline.id, contractId: skylineContract.id, name: "Mobilisation and excavation", dueDate: d("2025-12-15"), completionPercent: 100, billingPercent: 10, billingAmount: 11800000, status: "INVOICED", completedAt: d("2025-12-12") } }),
    prisma.contractMilestone.create({ data: { organizationId: organization.id, projectId: skyline.id, contractId: skylineContract.id, name: "Foundation complete", dueDate: d("2026-04-30"), completionPercent: 100, billingPercent: 20, billingAmount: 23600000, status: "INVOICED", completedAt: d("2026-05-06") } }),
    prisma.contractMilestone.create({ data: { organizationId: organization.id, projectId: skyline.id, contractId: skylineContract.id, name: "Structure up to level 12", dueDate: d("2026-09-30"), completionPercent: 62, billingPercent: 25, billingAmount: 29500000, status: "IN_PROGRESS" } })
  ]);
  const orionMilestones = await Promise.all([
    prisma.contractMilestone.create({ data: { organizationId: organization.id, projectId: orion.id, contractId: orionContract.id, name: "Site mobilisation", dueDate: d("2026-02-28"), completionPercent: 100, billingPercent: 8, billingAmount: 16400000, status: "INVOICED", completedAt: d("2026-02-26") } }),
    prisma.contractMilestone.create({ data: { organizationId: organization.id, projectId: orion.id, contractId: orionContract.id, name: "Block A foundations", dueDate: d("2026-08-31"), completionPercent: 78, billingPercent: 17, billingAmount: 34850000, status: "IN_PROGRESS" } })
  ]);
  await prisma.contractMilestone.create({ data: { organizationId: organization.id, projectId: riverside.id, contractId: riversideContract.id, name: "Design and approvals", dueDate: d("2026-10-31"), completionPercent: 20, billingPercent: 10, billingAmount: 8400000, status: "IN_PROGRESS" } });

  await prisma.projectPhase.createMany({
    data: [
      { organizationId: organization.id, projectId: skyline.id, milestoneId: skylineMilestones[0].id, name: "Excavation and shoring", status: "COMPLETED", completion: 100, assignee: "Rohit Kulkarni", startDate: d("2025-10-05"), endDate: d("2025-12-12") },
      { organizationId: organization.id, projectId: skyline.id, milestoneId: skylineMilestones[1].id, name: "Raft and foundations", status: "COMPLETED", completion: 100, assignee: "Civil Team A", startDate: d("2025-12-15"), endDate: d("2026-05-06") },
      { organizationId: organization.id, projectId: skyline.id, milestoneId: skylineMilestones[2].id, name: "Tower A RCC structure", status: "IN_PROGRESS", completion: 68, assignee: "Rohit Kulkarni", startDate: d("2026-05-10") },
      { organizationId: organization.id, projectId: skyline.id, name: "MEP first fix", status: "NOT_STARTED", completion: 0, assignee: "MEP Team", startDate: d("2026-09-01") },
      { organizationId: organization.id, projectId: orion.id, milestoneId: orionMilestones[0].id, name: "Mobilisation", status: "COMPLETED", completion: 100, assignee: "Project Controls", startDate: d("2026-01-15"), endDate: d("2026-02-26") },
      { organizationId: organization.id, projectId: orion.id, milestoneId: orionMilestones[1].id, name: "Block A substructure", status: "IN_PROGRESS", completion: 78, assignee: "Civil Team B", startDate: d("2026-03-01") }
    ]
  });

  const [cementVendor, steelVendor, electricalVendor] = await Promise.all([
    prisma.vendor.create({ data: { organizationId: organization.id, name: "SolidMix Materials", code: "VND-001", type: "MATERIAL_SUPPLIER", category: "Cement & concrete", contactPerson: "Deepak Jain", email: "sales@solidmix.example", phone: "+91 98200 11001", gstin: "27AABCS1234A1Z5", paymentTerms: "30 days", rating: 5, notes: "Preferred supplier for bulk cement and RMC." } }),
    prisma.vendor.create({ data: { organizationId: organization.id, name: "MetroSteel Trading", code: "VND-002", type: "MATERIAL_SUPPLIER", category: "Reinforcement steel", contactPerson: "Pooja Nair", phone: "+91 98200 22002", paymentTerms: "21 days", rating: 4 } }),
    prisma.vendor.create({ data: { organizationId: organization.id, name: "VoltEdge Systems", code: "VND-003", type: "BOTH", category: "Electrical materials", contactPerson: "Akash Verma", email: "projects@voltedge.example", paymentTerms: "30 days", rating: 4 } })
  ]);
  const [cementCategory, steelCategory, electricalCategory, finishingCategory] = await Promise.all([
    prisma.itemCategory.create({ data: { organizationId: organization.id, name: "Cement & concrete" } }),
    prisma.itemCategory.create({ data: { organizationId: organization.id, name: "Reinforcement steel" } }),
    prisma.itemCategory.create({ data: { organizationId: organization.id, name: "Electrical" } }),
    prisma.itemCategory.create({ data: { organizationId: organization.id, name: "Finishing" } })
  ]);
  const [cement, steel, cable, tiles] = await Promise.all([
    prisma.inventoryItem.create({ data: { organizationId: organization.id, categoryId: cementCategory.id, preferredVendorId: cementVendor.id, name: "OPC 53 Grade Cement", sku: "CEM-OPC53", unit: "Bag", purchasePrice: 410, averageCost: 406.5, reorderLevel: 600 } }),
    prisma.inventoryItem.create({ data: { organizationId: organization.id, categoryId: steelCategory.id, preferredVendorId: steelVendor.id, name: "TMT Fe 550D – 16 mm", sku: "TMT-16-550D", unit: "MT", purchasePrice: 61200, averageCost: 60500, reorderLevel: 18 } }),
    prisma.inventoryItem.create({ data: { organizationId: organization.id, categoryId: electricalCategory.id, preferredVendorId: electricalVendor.id, name: "FRLS Copper Cable 4 sqmm", sku: "CBL-FRLS-4", unit: "Rmt", purchasePrice: 72, averageCost: 70, reorderLevel: 2000 } }),
    prisma.inventoryItem.create({ data: { organizationId: organization.id, categoryId: finishingCategory.id, name: "Vitrified Tile 600 × 1200", sku: "TILE-6012", unit: "Sqft", purchasePrice: 82, averageCost: 82, reorderLevel: 1500 } })
  ]);
  const [central, skylineStore, orionStore] = await Promise.all([
    prisma.inventoryLocation.create({ data: { organizationId: organization.id, name: "Central Warehouse", code: "WH-CENTRAL", type: "CENTRAL_WAREHOUSE", address: "Bhiwandi, Maharashtra" } }),
    prisma.inventoryLocation.create({ data: { organizationId: organization.id, projectId: skyline.id, name: "Skyline Site Store", code: "SKY-STORE", type: "SITE_STORE", address: skyline.location } }),
    prisma.inventoryLocation.create({ data: { organizationId: organization.id, projectId: orion.id, name: "Orion Site Store", code: "OTP-STORE", type: "SITE_STORE", address: orion.location } }),
    prisma.inventoryLocation.create({ data: { organizationId: organization.id, projectId: riverside.id, name: "Riverside Site Store", code: "RSV-STORE", type: "SITE_STORE", address: riverside.location } })
  ]);
  await prisma.inventoryStock.createMany({
    data: [
      { organizationId: organization.id, itemId: cement.id, locationId: central.id, quantity: 950 },
      { organizationId: organization.id, itemId: cement.id, locationId: skylineStore.id, quantity: 720 },
      { organizationId: organization.id, itemId: cement.id, locationId: orionStore.id, quantity: 480 },
      { organizationId: organization.id, itemId: steel.id, locationId: central.id, quantity: 12 },
      { organizationId: organization.id, itemId: steel.id, locationId: skylineStore.id, quantity: 28.5 },
      { organizationId: organization.id, itemId: steel.id, locationId: orionStore.id, quantity: 16.2 },
      { organizationId: organization.id, itemId: cable.id, locationId: central.id, quantity: 1800 },
      { organizationId: organization.id, itemId: tiles.id, locationId: central.id, quantity: 0 }
    ]
  });
  const openingValue = 2150 * 406.5 + 56.7 * 60500 + 1800 * 70;
  await journal({ date: d("2026-01-01"), description: "Opening inventory balances", source: "OPENING", lines: [{ code: "1300", debit: openingValue }, { code: "3000", credit: openingValue }] });

  const po1 = await prisma.purchaseOrder.create({
    data: {
      organizationId: organization.id, projectId: skyline.id, vendorId: cementVendor.id, poNumber: "PO-2026-0001",
      orderDate: d("2026-07-02"), expectedDate: d("2026-07-08"), status: "RECEIVED", subtotal: 820000, taxAmount: 147600,
      totalAmount: 967600, requestedById: owner.id, requestedAt: d("2026-07-02"), approvedById: procurementUser.id, approvedAt: d("2026-07-03"),
      items: { create: { itemId: cement.id, description: "OPC 53 Grade Cement – approved make", quantity: 2000, receivedQuantity: 2000, unit: "Bag", unitPrice: 410, taxPercent: 18, lineTotal: 820000 } }
    },
    include: { items: true }
  });
  const receipt = await prisma.goodsReceipt.create({
    data: {
      organizationId: organization.id, purchaseOrderId: po1.id, locationId: skylineStore.id, receiptNumber: "GRN-2026-0001",
      receivedDate: d("2026-07-09"), receivedById: engineer.id, notes: "Quantity and batch test certificate verified.",
      items: { create: { purchaseOrderItemId: po1.items[0].id, itemId: cement.id, quantity: 2000, unitCost: 410 } }
    }
  });
  await prisma.stockMovement.create({ data: { organizationId: organization.id, itemId: cement.id, locationId: skylineStore.id, projectId: skyline.id, type: "RECEIPT", quantity: 2000, unitCost: 410, referenceType: "GoodsReceipt", referenceId: receipt.id, note: "PO-2026-0001 · GRN-2026-0001", occurredAt: d("2026-07-09"), createdById: engineer.id } });
  const materialBill = await prisma.vendorBill.create({ data: { organizationId: organization.id, projectId: skyline.id, vendorId: cementVendor.id, purchaseOrderId: po1.id, billNumber: "BILL-GRN-2026-0001", billDate: d("2026-07-09"), dueDate: d("2026-08-08"), amount: 967600, paidAmount: 0, status: "OPEN", description: "Cement receipt against PO-2026-0001" } });
  await journal({ date: d("2026-07-09"), description: "Inventory receipt · SolidMix Materials · GRN-2026-0001", source: "VENDOR_BILL", sourceId: materialBill.id, lines: [{ code: "1300", projectId: skyline.id, debit: 820000 }, { code: "1400", projectId: skyline.id, debit: 147600 }, { code: "2000", projectId: skyline.id, credit: 967600 }] });

  await prisma.purchaseOrder.create({
    data: {
      organizationId: organization.id, projectId: orion.id, vendorId: steelVendor.id, poNumber: "PO-2026-0002",
      orderDate: d("2026-07-21"), expectedDate: d("2026-08-02"), status: "APPROVED", subtotal: 1836000, taxAmount: 330480,
      totalAmount: 2166480, requestedById: owner.id, requestedAt: d("2026-07-21"), approvedById: procurementUser.id, approvedAt: d("2026-07-22"),
      items: { create: { itemId: steel.id, description: "TMT Fe 550D – 16 mm", quantity: 30, receivedQuantity: 0, unit: "MT", unitPrice: 61200, taxPercent: 18, lineTotal: 1836000 } }
    }
  });
  await prisma.purchaseOrder.create({
    data: {
      organizationId: organization.id, projectId: skyline.id, vendorId: electricalVendor.id, poNumber: "PO-2026-0003",
      orderDate: d("2026-07-26"), expectedDate: d("2026-08-10"), status: "REQUESTED", subtotal: 360000, taxAmount: 64800,
      totalAmount: 424800, requestedById: engineer.id, requestedAt: d("2026-07-26"),
      items: { create: { itemId: cable.id, description: "FRLS Copper Cable 4 sqmm", quantity: 5000, receivedQuantity: 0, unit: "Rmt", unitPrice: 72, taxPercent: 18, lineTotal: 360000 } }
    }
  });

  const issue = await prisma.materialIssue.create({
    data: {
      organizationId: organization.id, projectId: skyline.id, locationId: skylineStore.id, issueNumber: "MI-2026-0001",
      issueDate: d("2026-07-18"), issuedTo: "RCC Structure Team", phaseName: "Tower A RCC structure", issuedById: engineer.id,
      items: { create: [{ itemId: cement.id, quantity: 1280, unitCost: 406.5, lineTotal: 520320 }, { itemId: steel.id, quantity: 11.5, unitCost: 60500, lineTotal: 695750 }] }
    }
  });
  await prisma.stockMovement.createMany({
    data: [
      { organizationId: organization.id, itemId: cement.id, locationId: skylineStore.id, projectId: skyline.id, type: "PROJECT_ISSUE", quantity: -1280, unitCost: 406.5, referenceType: "MaterialIssue", referenceId: issue.id, note: "MI-2026-0001", occurredAt: d("2026-07-18"), createdById: engineer.id },
      { organizationId: organization.id, itemId: steel.id, locationId: skylineStore.id, projectId: skyline.id, type: "PROJECT_ISSUE", quantity: -11.5, unitCost: 60500, referenceType: "MaterialIssue", referenceId: issue.id, note: "MI-2026-0001", occurredAt: d("2026-07-18"), createdById: engineer.id }
    ]
  });
  await journal({ date: d("2026-07-18"), description: "Material issued · Skyline Heights · MI-2026-0001", source: "INVENTORY", sourceId: issue.id, lines: [{ code: "5000", projectId: skyline.id, debit: 1216070 }, { code: "1300", projectId: skyline.id, credit: 1216070 }] });

  const [civilSub, mepSub] = await Promise.all([
    prisma.subcontractor.create({ data: { organizationId: organization.id, name: "Precision Civil Works", code: "SUB-001", trade: "RCC & civil works", contactPerson: "Sanjay Patil", phone: "+91 98201 10001", gstin: "27AAPCP4587K1Z3", rating: 5, notes: "Strong safety and quality record." } }),
    prisma.subcontractor.create({ data: { organizationId: organization.id, name: "NexFlow MEP Services", code: "SUB-002", trade: "MEP installation", contactPerson: "Farhan Khan", email: "ops@nexflow.example", rating: 4 } })
  ]);
  const civilWorkOrder = await prisma.workOrder.create({
    data: { organizationId: organization.id, projectId: skyline.id, milestoneId: skylineMilestones[2].id, subcontractorId: civilSub.id, workOrderNumber: "WO-2026-0001", scope: "RCC framework, reinforcement fixing and concreting from podium to level 12.", startDate: d("2026-05-10"), endDate: d("2026-10-15"), value: 15200000, retentionPercent: 5, status: "IN_PROGRESS" }
  });
  await prisma.workOrder.create({
    data: { organizationId: organization.id, projectId: orion.id, milestoneId: orionMilestones[1].id, subcontractorId: civilSub.id, workOrderNumber: "WO-2026-0002", scope: "Block A substructure and retaining walls.", startDate: d("2026-03-01"), endDate: d("2026-09-15"), value: 9800000, retentionPercent: 5, status: "IN_PROGRESS" }
  });
  await prisma.workOrder.create({
    data: { organizationId: organization.id, projectId: skyline.id, subcontractorId: mepSub.id, workOrderNumber: "WO-2026-0003", scope: "Electrical first-fix, containment and earthing for Tower A.", startDate: d("2026-09-01"), endDate: d("2027-01-31"), value: 6400000, retentionPercent: 5, status: "ISSUED" }
  });
  const subBill = await prisma.vendorBill.create({ data: { organizationId: organization.id, projectId: skyline.id, subcontractorId: civilSub.id, workOrderId: civilWorkOrder.id, billNumber: "PCW/RA/2026/04", billDate: d("2026-07-20"), dueDate: d("2026-08-19"), amount: 3250000, paidAmount: 1250000, status: "PARTIALLY_PAID", description: "RA Bill 04 – RCC structure through level 7" } });
  await journal({ date: d("2026-07-20"), description: "Subcontractor bill · Precision Civil Works", source: "VENDOR_BILL", sourceId: subBill.id, lines: [{ code: "5100", projectId: skyline.id, debit: 3250000 }, { code: "2000", projectId: skyline.id, credit: 3250000 }] });
  const subPayment = await prisma.vendorPayment.create({ data: { organizationId: organization.id, vendorBillId: subBill.id, subcontractorId: civilSub.id, paymentDate: d("2026-07-25"), amount: 1250000, method: "Bank transfer", reference: "UTR-AXIS-725001" } });
  await journal({ date: d("2026-07-25"), description: "Subcontractor payment · Precision Civil Works", source: "VENDOR_PAYMENT", sourceId: subPayment.id, lines: [{ code: "2000", projectId: skyline.id, debit: 1250000 }, { code: "1000", credit: 1250000 }] });

  const employeeData = [
    ["EMP-001", "Rohit Kulkarni", "Senior Site Engineer", "Projects", 62000, 15000, 3500, skyline.id],
    ["EMP-002", "Meera Joshi", "Project Planner", "Projects", 70000, 18000, 4500, skyline.id],
    ["EMP-003", "Aditya Menon", "Quantity Surveyor", "Commercial", 68000, 16000, 4200, orion.id],
    ["EMP-004", "Sana Sheikh", "Safety Officer", "HSE", 48000, 12000, 2500, orion.id],
    ["EMP-005", "Vikram Yadav", "Store Supervisor", "Procurement", 38000, 9000, 1800, skyline.id]
  ] as const;
  const employees = [];
  for (const [employeeCode, name, designation, department, monthlyBasic, monthlyAllowances, defaultDeductions, projectId] of employeeData) {
    const employee = await prisma.employee.create({
      data: {
        organizationId: organization.id, employeeCode, name, designation, department, joiningDate: d("2025-10-01"),
        monthlyBasic, monthlyAllowances, defaultDeductions, annualLeaveBalance: 15,
        ...(employeeCode === "EMP-001" ? { userId: engineer.id, email: engineer.email } : {}),
        projectAssignments: { create: { projectId, startDate: d("2026-01-01"), allocation: 100 } }
      }
    });
    employees.push({ ...employee, projectId });
  }
  await prisma.employeeAttendance.createMany({
    data: employees.flatMap((employee) => [
      { organizationId: organization.id, employeeId: employee.id, projectId: employee.projectId, date: d("2026-07-27"), status: "PRESENT" },
      { organizationId: organization.id, employeeId: employee.id, projectId: employee.projectId, date: d("2026-07-28"), status: employee.employeeCode === "EMP-004" ? "LEAVE" : "PRESENT" }
    ])
  });
  await prisma.laborAttendance.createMany({
    data: [
      { organizationId: organization.id, projectId: skyline.id, date: d("2026-07-28"), laborCategory: "Masons", presentCount: 34, absentCount: 3, dailyRate: 950 },
      { organizationId: organization.id, projectId: skyline.id, date: d("2026-07-28"), laborCategory: "Helpers", presentCount: 52, absentCount: 5, dailyRate: 650 },
      { organizationId: organization.id, projectId: skyline.id, date: d("2026-07-28"), laborCategory: "Steel fixers", presentCount: 26, absentCount: 2, dailyRate: 1050 },
      { organizationId: organization.id, projectId: orion.id, date: d("2026-07-28"), laborCategory: "Carpenters", presentCount: 22, absentCount: 1, dailyRate: 1100 }
    ]
  });
  await prisma.leaveRequest.create({ data: { organizationId: organization.id, employeeId: employees[3].id, startDate: d("2026-07-28"), endDate: d("2026-07-29"), days: 2, type: "Sick leave", reason: "Medical recovery", status: "APPROVED", decidedById: hrUser.id, decidedAt: d("2026-07-27") } });
  const payroll = await prisma.payrollRun.create({ data: { organizationId: organization.id, month: 6, year: 2026, status: "PROCESSED", totalGross: 328000, totalDeductions: 16500, totalNet: 311500, processedAt: d("2026-06-30"), processedById: hrUser.id } });
  for (const employee of employees) {
    await prisma.payslip.create({ data: { organizationId: organization.id, payrollRunId: payroll.id, employeeId: employee.id, projectId: employee.projectId, basic: employee.monthlyBasic, allowances: employee.monthlyAllowances, deductions: employee.defaultDeductions, gross: Number(employee.monthlyBasic) + Number(employee.monthlyAllowances), netPay: Number(employee.monthlyBasic) + Number(employee.monthlyAllowances) - Number(employee.defaultDeductions) } });
  }
  await journal({ date: d("2026-06-30"), description: "Payroll · 06/2026", source: "PAYROLL", sourceId: payroll.id, lines: [{ code: "5200", projectId: skyline.id, debit: 212000 }, { code: "5200", projectId: orion.id, debit: 116000 }, { code: "2100", credit: 328000 }] });

  const invoice1 = await prisma.clientInvoice.create({ data: { organizationId: organization.id, projectId: skyline.id, milestoneId: skylineMilestones[0].id, invoiceNumber: "INV-2026-0001", issueDate: d("2026-01-05"), dueDate: d("2026-02-04"), subtotal: 11800000, taxAmount: 2124000, totalAmount: 13924000, paidAmount: 13924000, status: "PAID", notes: "Mobilisation milestone" } });
  const invoice2 = await prisma.clientInvoice.create({ data: { organizationId: organization.id, projectId: skyline.id, milestoneId: skylineMilestones[1].id, invoiceNumber: "INV-2026-0002", issueDate: d("2026-05-10"), dueDate: d("2026-06-09"), subtotal: 23600000, taxAmount: 4248000, totalAmount: 27848000, paidAmount: 18000000, status: "OVERDUE", notes: "Foundation completion certificate attached" } });
  const invoice3 = await prisma.clientInvoice.create({ data: { organizationId: organization.id, projectId: orion.id, milestoneId: orionMilestones[0].id, invoiceNumber: "INV-2026-0003", issueDate: d("2026-03-02"), dueDate: d("2026-03-23"), subtotal: 16400000, taxAmount: 2952000, totalAmount: 19352000, paidAmount: 19352000, status: "PAID" } });
  await journal({ date: invoice1.issueDate, description: "Client invoice · INV-2026-0001", source: "CLIENT_INVOICE", sourceId: invoice1.id, lines: [{ code: "1100", projectId: skyline.id, debit: 13924000 }, { code: "4000", projectId: skyline.id, credit: 11800000 }, { code: "2200", projectId: skyline.id, credit: 2124000 }] });
  await journal({ date: invoice2.issueDate, description: "Client invoice · INV-2026-0002", source: "CLIENT_INVOICE", sourceId: invoice2.id, lines: [{ code: "1100", projectId: skyline.id, debit: 27848000 }, { code: "4000", projectId: skyline.id, credit: 23600000 }, { code: "2200", projectId: skyline.id, credit: 4248000 }] });
  await journal({ date: invoice3.issueDate, description: "Client invoice · INV-2026-0003", source: "CLIENT_INVOICE", sourceId: invoice3.id, lines: [{ code: "1100", projectId: orion.id, debit: 19352000 }, { code: "4000", projectId: orion.id, credit: 16400000 }, { code: "2200", projectId: orion.id, credit: 2952000 }] });
  const clientPayment1 = await prisma.clientPayment.create({ data: { organizationId: organization.id, invoiceId: invoice1.id, paymentDate: d("2026-02-02"), amount: 13924000, method: "Bank transfer", reference: "HDFC-NSR-0202" } });
  const clientPayment2 = await prisma.clientPayment.create({ data: { organizationId: organization.id, invoiceId: invoice2.id, paymentDate: d("2026-06-18"), amount: 18000000, method: "Bank transfer", reference: "HDFC-NSR-0618" } });
  const clientPayment3 = await prisma.clientPayment.create({ data: { organizationId: organization.id, invoiceId: invoice3.id, paymentDate: d("2026-03-20"), amount: 19352000, method: "Bank transfer", reference: "ICICI-VSP-0320" } });
  for (const payment of [{ payment: clientPayment1, projectId: skyline.id }, { payment: clientPayment2, projectId: skyline.id }, { payment: clientPayment3, projectId: orion.id }]) {
    await journal({ date: payment.payment.paymentDate, description: `Client payment · ${payment.payment.reference}`, source: "CLIENT_PAYMENT", sourceId: payment.payment.id, lines: [{ code: "1000", debit: Number(payment.payment.amount) }, { code: "1100", projectId: payment.projectId, credit: Number(payment.payment.amount) }] });
  }
  await ensureDemoPaymentReceipts(organization.id, owner.id, organization.currency);
  const expense1 = await prisma.expense.create({ data: { organizationId: organization.id, projectId: skyline.id, accountId: accounts.get("5300")!, expenseDate: d("2026-07-12"), amount: 84500, vendorName: "Mumbai Crane Services", description: "Mobile crane hire – 2 shifts", paymentMethod: "Bank transfer", reference: "MCS-0712" } });
  const expense2 = await prisma.expense.create({ data: { organizationId: organization.id, projectId: orion.id, accountId: accounts.get("5300")!, expenseDate: d("2026-07-15"), amount: 46200, vendorName: "Rapid Testing Labs", description: "Concrete cube testing", paymentMethod: "Bank transfer", reference: "RTL-0715" } });
  await journal({ date: expense1.expenseDate, description: `Expense · ${expense1.description}`, source: "EXPENSE", sourceId: expense1.id, lines: [{ code: "5300", projectId: skyline.id, debit: 84500 }, { code: "1000", credit: 84500 }] });
  await journal({ date: expense2.expenseDate, description: `Expense · ${expense2.description}`, source: "EXPENSE", sourceId: expense2.id, lines: [{ code: "5300", projectId: orion.id, debit: 46200 }, { code: "1000", credit: 46200 }] });

  await prisma.landingPage.create({
    data: {
      organizationId: organization.id,
      heroTitle: "We build places that move cities forward.",
      heroSubtitle: "Apex Buildcon delivers complex residential and commercial projects with disciplined execution, transparent progress and uncompromising quality.",
      aboutTitle: "Built on accountability",
      aboutBody: "From pre-construction planning to final handover, our teams combine field experience with live operational control. Every milestone, material and decision remains visible to the people responsible for delivery.",
      services: ["General contracting", "Project management", "Civil and structural works", "MEP coordination", "Commercial fit-outs", "Pre-construction planning"],
      showcaseProjectIds: [skyline.id, orion.id, riverside.id],
      contactEmail: "projects@apexbuildcon.example",
      contactPhone: "+91 22 4000 8800",
      primaryColor: "#245DFF",
      published: true
    }
  });
  await prisma.lead.createMany({
    data: [
      { organizationId: organization.id, name: "Nikhil Desai", email: "nikhil@urbanarc.example", phone: "+91 98190 12001", message: "We are evaluating contractors for a 2.5 lakh sq ft commercial development in Thane.", status: "QUALIFIED", source: "Public company page" },
      { organizationId: organization.id, name: "Rhea Kapoor", email: "rhea@habitat.example", message: "Please share credentials for premium residential execution in Mumbai.", status: "NEW", source: "Public company page" }
    ]
  });

  console.log("Bizavo demo seeded.");
  console.log("Login: owner@demo.bizavo.in / Bizavo@2026");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
