"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createBusinessDocument } from "@/app/app/documents/actions";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { money } from "@/lib/utils";

type LineItem = {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  taxPercent: number;
};

function newItem(): LineItem {
  return { id: crypto.randomUUID(), description: "", quantity: 1, unit: "unit", unitPrice: 0, taxPercent: 0 };
}

export function DocumentComposer({ projects, currency }: { projects: { id: string; name: string; code: string; clientName: string; clientEmail: string | null; clientPhone: string | null; location: string }[]; currency: string }) {
  const [items, setItems] = useState<LineItem[]>([newItem()]);
  const [projectId, setProjectId] = useState("");
  const selectedProject = projects.find((project) => project.id === projectId);
  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const tax = items.reduce((sum, item) => sum + item.quantity * item.unitPrice * (item.taxPercent / 100), 0);
    return { subtotal, tax, total: subtotal + tax };
  }, [items]);

  function updateItem(id: string, patch: Partial<LineItem>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  return (
    <form action={createBusinessDocument} className="space-y-8">
      <input
        type="hidden"
        name="itemsJson"
        value={JSON.stringify(items.map((item) => ({ description: item.description, quantity: item.quantity, unit: item.unit, unitPrice: item.unitPrice, taxPercent: item.taxPercent })))}
      />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <FormField label="Document type">
          <Select name="type" required defaultValue="SALES_RECEIPT">
            <option value="SALES_RECEIPT">Sales receipt</option>
            <option value="PAYMENT_RECEIPT">Payment receipt</option>
            <option value="QUOTATION">Quotation</option>
            <option value="PROFORMA_INVOICE">Proforma invoice</option>
          </Select>
        </FormField>
        <FormField label="Issue date">
          <Input name="issueDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
        </FormField>
        <FormField label="Project / client">
          <Select
            name="projectId"
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
          >
            <option value="">No linked project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.code} · {project.name}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Recipient name">
          <Input name="recipientName" required defaultValue={selectedProject?.clientName ?? ""} key={`name-${projectId}`} />
        </FormField>
        <FormField label="Email">
          <Input name="recipientEmail" type="email" defaultValue={selectedProject?.clientEmail ?? ""} key={`email-${projectId}`} />
        </FormField>
        <FormField label="WhatsApp number">
          <Input name="recipientPhone" placeholder="+91 98765 43210" defaultValue={selectedProject?.clientPhone ?? ""} key={`phone-${projectId}`} />
        </FormField>
        <FormField label="Payment method">
          <Select name="paymentMethod" defaultValue="">
            <option value="">Not applicable</option>
            <option>Bank transfer</option>
            <option>UPI</option>
            <option>Cheque</option>
            <option>Cash</option>
            <option>Card</option>
          </Select>
        </FormField>
        <FormField label="Payment reference">
          <Input name="paymentReference" placeholder="UTR / cheque / transaction ID" />
        </FormField>
        <FormField label="Billing address" className="md:col-span-2 xl:col-span-4">
          <Textarea name="billingAddress" rows={2} defaultValue={selectedProject?.location ?? ""} key={`address-${projectId}`} />
        </FormField>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white">
        <div className="flex items-center justify-between border-b bg-slate-50/80 px-5 py-4">
          <div>
            <h3 className="font-semibold text-slate-950">Line items</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Add up to 25 items. Taxes are calculated per line.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setItems((current) => [...current, newItem()])} disabled={items.length >= 25}>
            <Plus className="h-4 w-4" /> Add line
          </Button>
        </div>
        <div className="space-y-3 p-4">
          {items.map((item, index) => (
            <div key={item.id} className="grid items-end gap-3 rounded-xl border bg-white p-3 md:grid-cols-[minmax(220px,2fr)_100px_100px_140px_100px_110px_40px]">
              <FormField label={index === 0 ? "Description" : `Item ${index + 1}`}>
                <Input value={item.description} onChange={(event) => updateItem(item.id, { description: event.target.value })} placeholder="Material, service or payment description" required />
              </FormField>
              <FormField label="Quantity"><Input type="number" min="0.001" step="0.001" value={item.quantity} onChange={(event) => updateItem(item.id, { quantity: Number(event.target.value) })} required /></FormField>
              <FormField label="Unit"><Input value={item.unit} onChange={(event) => updateItem(item.id, { unit: event.target.value })} required /></FormField>
              <FormField label="Unit price"><Input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(event) => updateItem(item.id, { unitPrice: Number(event.target.value) })} required /></FormField>
              <FormField label="Tax %"><Input type="number" min="0" max="100" step="0.01" value={item.taxPercent} onChange={(event) => updateItem(item.id, { taxPercent: Number(event.target.value) })} /></FormField>
              <div className="pb-2 text-right text-sm font-semibold">{money(item.quantity * item.unitPrice, currency)}</div>
              <Button type="button" variant="ghost" size="icon" aria-label="Remove line" onClick={() => setItems((current) => current.filter((line) => line.id !== item.id))} disabled={items.length === 1}>
                <Trash2 className="h-4 w-4 text-slate-500" />
              </Button>
            </div>
          ))}
        </div>
        <div className="ml-auto grid max-w-sm gap-2 border-t bg-slate-50/80 p-5 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-medium">{money(totals.subtotal, currency)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span className="font-medium">{money(totals.tax, currency)}</span></div>
          <div className="mt-1 flex justify-between border-t pt-3 text-base font-bold"><span>Total</span><span>{money(totals.total, currency)}</span></div>
        </div>
      </div>

      <FormField label="Notes">
        <Textarea name="notes" rows={3} placeholder="Payment terms, validity or a note for the recipient" />
      </FormField>
      <div className="flex justify-end">
        <Button type="submit" size="lg">Create and issue document</Button>
      </div>
    </form>
  );
}
