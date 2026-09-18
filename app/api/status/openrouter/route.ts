import { NextResponse } from "next/server";
import { getKeyCount } from "@/lib/openrouter_keys";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    connected: getKeyCount() > 0,
  });
}
