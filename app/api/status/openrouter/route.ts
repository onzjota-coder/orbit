import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    connected: Boolean(process.env.OPENROUTER_API_KEY),
  });
}
