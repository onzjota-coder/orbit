import { NextResponse } from "next/server";
import { providersStatus } from "@/lib/image-providers/registry";

export const dynamic = "force-dynamic";

// GET /api/image/providers → quais provedores estão configurados no servidor.
// NUNCA expõe valores de chave — só id/label/modelos/boolean.
export async function GET() {
  return NextResponse.json({ providers: providersStatus() });
}
