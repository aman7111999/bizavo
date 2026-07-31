import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  BriefcaseBusiness,
  Building2,
  Check,
  ChevronRight,
  CircleDollarSign,
  Dumbbell,
  Factory,
  FileCheck2,
  Files,
  HeartPulse,
  Layers3,
  LockKeyhole,
  Network,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  UsersRound,
  Workflow
} from "lucide-react";
import { MarketingHeader } from "@/components/marketing-header";

export const metadata: Metadata = {
  title: "Bizavo — One connected system for every business",
  description: "Run projects, people, inventory, payroll, finance, documents and customer operations from one connected business platform.",
  openGraph: {
    title: "Bizavo — One connected system for every business",
    description: "A connected operating system built for the way your industry actually works.",
    type: "website",
    url: "https://bizavo.vercel.app"
  }
};

type Product = {
  name: string;
  eyebrow: string;
  description: string;
  icon: LucideIcon;
  color: string;
  surface: string;
  modules: string[];
  live?: boolean;
};

const products: Product[] = [
  {
    name: "Bizavo Construction",
    eyebrow: "Available now",
    description: "Control projects, contracts, procurement, site inventory, subcontractors, workforce and project profitability in one operating system.",
    icon: Building2,
    color: "#245DFF",
    surface: "#eef3ff",
    modules: ["Projects", "Procurement", "Inventory", "Payroll", "Finance", "Documents"],
    live: true
  },
  {
    name: "Bizavo Retail",
    eyebrow: "On the roadmap",
    description: "Connected purchasing, multi-location stock, staff operations, daily sales and business finance for modern retail teams.",
    icon: ShoppingBag,
    color: "#7c3aed",
    surface: "#f4f0ff",
    modules: ["POS-ready", "Inventory", "Purchasing"]
  },
  {
    name: "Bizavo Health",
    eyebrow: "On the roadmap",
    description: "A calmer operational layer for clinics and hospitals, bringing staff, documents, vendors and financial control together.",
    icon: HeartPulse,
    color: "#0f9f7a",
    surface: "#eafaf5",
    modules: ["Workforce", "Vendors", "Finance"]
  },
  {
    name: "Bizavo Fitness",
    eyebrow: "On the roadmap",
    description: "Memberships, trainers, payroll, renewals, expenses and multiple branches built into one easy workspace.",
    icon: Dumbbell,
    color: "#e3542f",
    surface: "#fff1ed",
    modules: ["Members", "Staff", "Renewals"]
  },
  {
    name: "Bizavo Services",
    eyebrow: "On the roadmap",
    description: "Manage clients, projects, people, proposals, billing and delivery for agencies and professional service businesses.",
    icon: BriefcaseBusiness,
    color: "#c58312",
    surface: "#fff8e8",
    modules: ["CRM", "Projects", "Billing"]
  },
  {
    name: "Bizavo Manufacturing",
    eyebrow: "On the roadmap",
    description: "Bring procurement, materials, workforce, documents and financial visibility into one operational backbone.",
    icon: Factory,
    color: "#456078",
    surface: "#edf3f7",
    modules: ["Materials", "Purchasing", "Finance"]
  }
];

const platformCapabilities = [
  { name: "Customer operations", description: "Leads, customers, conversations and follow-ups stay connected to the work that follows.", icon: UsersRound },
  { name: "Finance & billing", description: "Invoices, receipts, payables, expenses and accounting share one reliable financial trail.", icon: CircleDollarSign },
  { name: "People & payroll", description: "Employees, attendance, leave, salary processing and downloadable payslips work together.", icon: ReceiptText },
  { name: "Purchasing & inventory", description: "Control vendors, orders, receipts, locations, stock movement and material consumption.", icon: PackageCheck },
  { name: "Documents", description: "Create, store, download and securely share business documents from the same workspace.", icon: Files },
  { name: "Workflow automation", description: "Approvals, reminders and repeatable processes reduce manual coordination across teams.", icon: Workflow }
];

const constructionModules = [
  "Project & contract management",
  "Vendor and purchase orders",
  "Site inventory and material issues",
  "Subcontractor work orders",
  "Attendance, leave and payroll",
  "Invoices, receipts and accounting",
  "Project-wise profit and loss",
  "Public company page and leads"
];

function ProductCard({ product }: { product: Product }) {
  const Icon = product.icon;
  return (
    <article className="group flex h-full flex-col rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_18px_55px_rgba(15,35,74,0.055)] transition duration-300 hover:-translate-y-1.5 hover:border-slate-300 hover:shadow-[0_24px_70px_rgba(15,35,74,0.1)] sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <span className="grid h-12 w-12 place-items-center rounded-2xl" style={{ color: product.color, backgroundColor: product.surface }}>
          <Icon className="h-6 w-6" />
        </span>
        <span className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] ${product.live ? "bg-blue-50 text-[#245dff]" : "bg-slate-100 text-slate-500"}`}>
          {product.eyebrow}
        </span>
      </div>
      <h3 className="mt-6 text-xl font-bold tracking-[-0.025em] text-[#0b1739]">{product.name}</h3>
      <p className="mt-3 flex-1 text-[15px] leading-7 text-slate-600">{product.description}</p>
      <div className="mt-6 flex flex-wrap gap-2">
        {product.modules.map((module) => <span key={module} className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600">{module}</span>)}
      </div>
      {product.live ? (
        <Link href="#construction" className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-[#245dff]">Explore Construction <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></Link>
      ) : (
        <p className="mt-7 text-xs font-semibold text-slate-400">Built on the shared Bizavo platform</p>
      )}
    </article>
  );
}

export default function HomePage() {
  return (
    <main className="overflow-hidden bg-white text-[#0b1739]">
      <MarketingHeader />

      <section className="relative isolate border-b border-slate-200/70 bg-[#f8faff]">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_18%,rgba(36,93,255,0.11),transparent_30%),radial-gradient(circle_at_86%_24%,rgba(0,184,217,0.09),transparent_25%)]" />
        <div className="absolute inset-x-0 top-0 -z-10 h-full opacity-[0.32] [background-image:linear-gradient(rgba(46,70,125,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(46,70,125,.08)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent_80%)]" />
        <div className="mx-auto grid min-h-[760px] max-w-[1440px] items-center gap-16 px-5 py-20 sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:px-12 lg:py-24">
          <div className="max-w-2xl">
            <Link href="#construction" className="inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-white px-3.5 py-2 text-xs font-bold text-[#245dff] shadow-sm">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-60" /><span className="relative h-2 w-2 rounded-full bg-[#245dff]" /></span>
              Bizavo Construction is live <ChevronRight className="h-3.5 w-3.5" />
            </Link>
            <h1 className="mt-7 text-balance text-[46px] font-extrabold leading-[1.02] tracking-[-0.055em] text-[#071a5c] sm:text-[60px] lg:text-[72px]">
              One system for the way your <span className="bg-gradient-to-r from-[#245dff] to-[#00a9c9] bg-clip-text text-transparent">business works.</span>
            </h1>
            <p className="mt-7 max-w-xl text-[17px] leading-8 text-slate-600 sm:text-lg">
              Bizavo connects customers, projects, people, inventory, payroll, finance and documents in one easy workspace—shaped for your industry.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/register" className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-[#245dff] px-6 py-3.5 text-sm font-bold text-white shadow-[0_14px_32px_rgba(36,93,255,0.25)] transition hover:-translate-y-0.5 hover:bg-[#174be0]">
                Start with Construction <ArrowUpRight className="h-4 w-4" />
              </Link>
              <Link href="#products" className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-6 py-3.5 text-sm font-bold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50">
                Explore all products <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold text-slate-500">
              {["14-day free trial", "No card required", "Made for Indian businesses"].map((item) => <span key={item} className="flex items-center gap-2"><span className="grid h-4 w-4 place-items-center rounded-full bg-emerald-50 text-emerald-600"><Check className="h-2.5 w-2.5 stroke-[3]" /></span>{item}</span>)}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[680px] lg:mx-0">
            <div className="absolute -inset-8 -z-10 rounded-[48px] bg-gradient-to-br from-blue-200/40 to-cyan-100/20 blur-2xl" />
            <div className="rounded-[30px] border border-white/90 bg-white/90 p-3 shadow-[0_30px_100px_rgba(20,49,112,0.16)] backdrop-blur sm:p-4">
              <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-[#f7f9fd]">
                <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
                  <div className="flex items-center gap-2.5"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#071a5c] text-white"><Layers3 className="h-3.5 w-3.5" /></span><span className="text-xs font-bold text-[#071a5c]">Bizavo workspace</span></div>
                  <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400" /><span className="text-[10px] font-semibold text-slate-500">All systems connected</span></div>
                </div>
                <div className="grid gap-3 p-4 sm:grid-cols-[0.74fr_1.26fr] sm:p-5">
                  <div className="space-y-3">
                    <div className="rounded-2xl bg-[#071a5c] p-4 text-white">
                      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-blue-200">Business overview</p>
                      <p className="mt-4 text-[26px] font-bold tracking-[-0.04em]">₹12.8 Cr</p>
                      <p className="mt-1 text-[10px] text-blue-200">Connected contract value</p>
                      <div className="mt-5 flex h-16 items-end gap-1.5">{[36, 50, 42, 62, 58, 78, 70, 91].map((height, index) => <span key={index} className="flex-1 rounded-t bg-gradient-to-t from-[#245dff] to-[#66d9ef]" style={{ height: `${height}%` }} />)}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">
                      {[{ label: "People", value: "84", icon: UsersRound }, { label: "Documents", value: "128", icon: FileCheck2 }].map((item) => <div key={item.label} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-[#245dff]"><item.icon className="h-4 w-4" /></span><div><p className="text-[9px] font-semibold text-slate-400">{item.label}</p><p className="text-base font-bold text-[#0b1739]">{item.value}</p></div></div>)}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between"><div><p className="text-[10px] font-semibold text-slate-400">Connected operations</p><p className="mt-0.5 text-sm font-bold">Everything moves together</p></div><Network className="h-5 w-5 text-[#245dff]" /></div>
                      <div className="relative mt-4 grid grid-cols-3 gap-2">
                        <div className="absolute left-[16%] right-[16%] top-[31px] h-px bg-blue-200" />
                        {[{ label: "CRM", icon: UsersRound }, { label: "Work", icon: Building2 }, { label: "Finance", icon: CircleDollarSign }, { label: "People", icon: ReceiptText }, { label: "Stock", icon: Boxes }, { label: "Docs", icon: Files }].map((item) => <div key={item.label} className="relative z-10 rounded-xl border border-slate-100 bg-[#fafbfe] p-2.5 text-center"><span className="mx-auto grid h-8 w-8 place-items-center rounded-xl bg-white text-[#245dff] shadow-sm"><item.icon className="h-3.5 w-3.5" /></span><p className="mt-1.5 text-[9px] font-bold text-slate-600">{item.label}</p></div>)}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between"><p className="text-xs font-bold">Today across your business</p><span className="rounded-full bg-emerald-50 px-2 py-1 text-[8px] font-bold text-emerald-600">LIVE</span></div>
                      <div className="mt-3 space-y-2.5">{[
                        { label: "Milestone invoice issued", meta: "Finance · 8 min ago", color: "bg-blue-500" },
                        { label: "Material receipt approved", meta: "Inventory · 24 min ago", color: "bg-cyan-500" },
                        { label: "Payroll batch processed", meta: "People · Today", color: "bg-violet-500" }
                      ].map((item) => <div key={item.label} className="flex items-center gap-2.5"><span className={`h-2 w-2 rounded-full ${item.color}`} /><div className="min-w-0"><p className="truncate text-[10px] font-bold text-slate-700">{item.label}</p><p className="text-[8px] text-slate-400">{item.meta}</p></div></div>)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-7 -left-2 hidden items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-[0_16px_44px_rgba(24,47,95,0.14)] sm:flex lg:-left-10">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><RefreshCw className="h-4 w-4" /></span><div><p className="text-[10px] text-slate-400">One update</p><p className="text-xs font-bold">Every report stays current</p></div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white py-8">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-center gap-x-12 gap-y-5 px-5 text-xs font-bold uppercase tracking-[0.14em] text-slate-400 sm:px-8 lg:px-12">
          <span className="normal-case tracking-normal text-slate-500">One shared source for</span>
          {[
            ["Customers", UsersRound], ["Work", Building2], ["People", ReceiptText], ["Inventory", Boxes], ["Money", CircleDollarSign], ["Documents", Files]
          ].map(([label, Icon]) => <span key={label as string} className="flex items-center gap-2 text-slate-500"><Icon className="h-4 w-4 text-slate-400" />{label as string}</span>)}
        </div>
      </section>

      <section id="products" className="scroll-mt-24 bg-white py-24 sm:py-28">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
          <div className="max-w-3xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#245dff]">The Bizavo product family</p>
            <h2 className="mt-4 text-balance text-4xl font-extrabold tracking-[-0.045em] text-[#071a5c] sm:text-5xl">One platform. Purpose-built for each industry.</h2>
            <p className="mt-5 max-w-2xl text-[16px] leading-8 text-slate-600">Every Bizavo product shares the same trusted foundation, then adds the workflows, language and reports that matter to that business.</p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => <ProductCard key={product.name} product={product} />)}
          </div>
        </div>
      </section>

      <section id="platform" className="scroll-mt-24 bg-[#071a5c] py-24 text-white sm:py-28">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
          <div className="grid gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-cyan-300">Shared platform</p>
              <h2 className="mt-4 text-balance text-4xl font-extrabold tracking-[-0.045em] sm:text-5xl">The essentials should already work together.</h2>
              <p className="mt-6 text-[16px] leading-8 text-blue-100">No duplicate entries. No disconnected reports. No moving data between five different tools just to understand your business.</p>
              <div className="mt-8 inline-flex items-center gap-3 rounded-2xl border border-white/15 bg-white/8 p-4">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-300 text-[#071a5c]"><Sparkles className="h-5 w-5" /></span>
                <div><p className="text-xs text-blue-200">The Bizavo principle</p><p className="mt-0.5 text-sm font-bold">Enter once. Use everywhere.</p></div>
              </div>
            </div>
            <div className="grid gap-px overflow-hidden rounded-[28px] border border-white/15 bg-white/15 sm:grid-cols-2">
              {platformCapabilities.map((capability) => <div key={capability.name} className="bg-[#0a205f] p-6 transition hover:bg-[#0d286f] sm:p-7"><capability.icon className="h-6 w-6 text-cyan-300" /><h3 className="mt-5 text-lg font-bold">{capability.name}</h3><p className="mt-2 text-sm leading-6 text-blue-100/80">{capability.description}</p></div>)}
            </div>
          </div>
        </div>
      </section>

      <section id="construction" className="scroll-mt-24 bg-[#f7f9fd] py-24 sm:py-28">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
          <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#245dff]"><span className="h-1.5 w-1.5 rounded-full bg-[#245dff]" />Available now</span>
              <p className="mt-6 text-sm font-bold text-[#245dff]">Bizavo Construction</p>
              <h2 className="mt-3 text-balance text-4xl font-extrabold tracking-[-0.045em] text-[#071a5c] sm:text-5xl">Know what is happening across every project.</h2>
              <p className="mt-6 text-[16px] leading-8 text-slate-600">From the first contract to the final payment, every project, material, vendor, employee and rupee stays connected to the same operational truth.</p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {constructionModules.map((module) => <div key={module} className="flex items-start gap-3 rounded-xl bg-white p-3.5 text-sm font-semibold text-slate-700 shadow-sm"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-600"><Check className="h-3 w-3 stroke-[3]" /></span>{module}</div>)}
              </div>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link href="/register" className="inline-flex items-center gap-2 rounded-xl bg-[#245dff] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_28px_rgba(36,93,255,0.22)]">Start free <ArrowUpRight className="h-4 w-4" /></Link>
                <Link href="/login" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700">View demo workspace <ArrowRight className="h-4 w-4" /></Link>
              </div>
            </div>
            <div className="relative">
              <div className="rounded-[30px] border border-slate-200 bg-white p-4 shadow-[0_24px_80px_rgba(21,49,106,0.12)] sm:p-5">
                <div className="rounded-[22px] bg-[#071a5c] p-5 text-white sm:p-6">
                  <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-blue-200">Project control</p><h3 className="mt-2 text-xl font-bold">Skyline Heights</h3><p className="mt-1 text-xs text-blue-200">Powai, Mumbai · Active</p></div><span className="rounded-lg bg-emerald-400/15 px-2.5 py-1.5 text-[9px] font-bold text-emerald-300">ON TRACK</span></div>
                  <div className="mt-7 grid grid-cols-3 gap-3">{[{ label: "Contract", value: "₹8.4 Cr" }, { label: "Spent", value: "₹3.1 Cr" }, { label: "Margin", value: "18.6%" }].map((item) => <div key={item.label} className="rounded-xl bg-white/8 p-3"><p className="text-[9px] text-blue-200">{item.label}</p><p className="mt-1 text-sm font-bold sm:text-base">{item.value}</p></div>)}</div>
                  <div className="mt-6"><div className="flex justify-between text-[9px] font-semibold text-blue-200"><span>Overall progress</span><span>62%</span></div><div className="mt-2 h-2 rounded-full bg-white/10"><div className="h-2 w-[62%] rounded-full bg-gradient-to-r from-[#245dff] to-cyan-300" /></div></div>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center justify-between"><p className="text-xs font-bold">Budget vs actual</p><CircleDollarSign className="h-4 w-4 text-[#245dff]" /></div><div className="mt-5 flex h-28 items-end justify-center gap-6"><div className="flex h-full w-12 items-end rounded-t-xl bg-blue-50"><div className="h-[78%] w-full rounded-t-xl bg-blue-200" /></div><div className="flex h-full w-12 items-end rounded-t-xl bg-blue-50"><div className="h-[52%] w-full rounded-t-xl bg-[#245dff]" /></div></div><div className="mt-2 flex justify-center gap-7 text-[9px] font-semibold text-slate-400"><span>Budget</span><span>Actual</span></div></div>
                  <div className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center justify-between"><p className="text-xs font-bold">Needs attention</p><span className="rounded-full bg-amber-50 px-2 py-1 text-[8px] font-bold text-amber-600">3 ITEMS</span></div><div className="mt-4 space-y-3">{[{ label: "Cement below reorder level", icon: Boxes }, { label: "Vendor bill due Friday", icon: ReceiptText }, { label: "Milestone approval pending", icon: FileCheck2 }].map((item) => <div key={item.label} className="flex items-center gap-2.5"><span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-50 text-slate-500"><item.icon className="h-3.5 w-3.5" /></span><p className="text-[10px] font-semibold text-slate-600">{item.label}</p></div>)}</div></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="why-bizavo" className="scroll-mt-24 bg-white py-24 sm:py-28">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
          <div className="text-center">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#245dff]">Why Bizavo</p>
            <h2 className="mx-auto mt-4 max-w-3xl text-balance text-4xl font-extrabold tracking-[-0.045em] text-[#071a5c] sm:text-5xl">Simple enough to adopt. Serious enough to run the business.</h2>
          </div>
          <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {[
              { title: "One business identity", body: "Customers, vendors, employees and projects connect across every enabled product.", icon: Network },
              { title: "Clear access control", body: "People see only the organizations, projects and financial information their role allows.", icon: LockKeyhole },
              { title: "Real financial truth", body: "Operational transactions flow into billing, payables and accounting without duplicate work.", icon: ShieldCheck },
              { title: "Ready to expand", body: "Start with what you need today and add products or modules without rebuilding your system.", icon: Layers3 }
            ].map((item) => <div key={item.title} className="rounded-[24px] border border-slate-200 bg-white p-6"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#eef3ff] text-[#245dff]"><item.icon className="h-5 w-5" /></span><h3 className="mt-5 text-lg font-bold">{item.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p></div>)}
          </div>
        </div>
      </section>

      <section className="px-5 pb-24 sm:px-8 sm:pb-28 lg:px-12">
        <div className="relative mx-auto max-w-[1344px] overflow-hidden rounded-[34px] bg-[#071a5c] px-6 py-16 text-center text-white sm:px-12 sm:py-20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(36,93,255,.55),transparent_30%),radial-gradient(circle_at_86%_90%,rgba(0,184,217,.32),transparent_28%)]" />
          <div className="relative mx-auto max-w-3xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-cyan-300">Start with what is live today</p>
            <h2 className="mt-4 text-balance text-4xl font-extrabold tracking-[-0.045em] sm:text-5xl">Run your construction business with one connected system.</h2>
            <p className="mx-auto mt-5 max-w-2xl text-[16px] leading-8 text-blue-100">Create your workspace, add your first project and bring your team, vendors, inventory, payroll and finance into Bizavo.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/register" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-[#071a5c]">Create free workspace <ArrowUpRight className="h-4 w-4" /></Link><Link href="/login" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-6 py-3.5 text-sm font-bold text-white">Sign in to Bizavo <ArrowRight className="h-4 w-4" /></Link></div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-[#f8faff]">
        <div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.4fr_0.6fr_0.6fr] lg:px-12">
          <div><div className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-[11px] bg-[#071a5c] text-white"><Layers3 className="h-[18px] w-[18px]" /></span><span className="text-xl font-extrabold tracking-[-0.04em] text-[#071a5c]">Bizavo</span></div><p className="mt-4 max-w-sm text-sm leading-6 text-slate-500">One connected operating system for every kind of business.</p></div>
          <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">Explore</p><div className="mt-4 grid gap-3 text-sm font-semibold text-slate-600"><Link href="#products">Products</Link><Link href="#platform">Platform</Link><Link href="#construction">Construction</Link></div></div>
          <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">Account</p><div className="mt-4 grid gap-3 text-sm font-semibold text-slate-600"><Link href="/login">Sign in</Link><Link href="/register">Create workspace</Link></div></div>
        </div>
        <div className="mx-auto flex max-w-[1440px] flex-col gap-2 border-t border-slate-200 px-5 py-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12"><p>© {new Date().getFullYear()} Bizavo. All rights reserved.</p><p>One connected system.</p></div>
      </footer>
    </main>
  );
}
