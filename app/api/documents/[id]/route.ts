import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.organizationId) return new NextResponse("Unauthorized", { status: 401 });
  const document = await prisma.projectDocument.findFirst({
    where: { id: params.id, organizationId: session.organizationId }
  });
  if (!document) return new NextResponse("Not found", { status: 404 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "project-documents";
  if (!url || !key) return new NextResponse("Storage is not configured", { status: 503 });
  const client = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await client.storage.from(bucket).createSignedUrl(document.storagePath, 60);
  if (error || !data.signedUrl) return new NextResponse("Unable to open document", { status: 502 });
  return NextResponse.redirect(data.signedUrl);
}
