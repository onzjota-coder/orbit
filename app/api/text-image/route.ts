import { NextResponse } from "next/server";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const prompt =
    typeof body === "object" && body !== null && "prompt" in body
      ? body.prompt
      : undefined;

  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 500) {
    return NextResponse.json({ error: "Prompt inválido." }, { status: 400 });
  }

  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.trim())}?width=1024&height=1024&model=flux&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;

  let res: Response;
  try {
    res = await fetch(url, { method: "GET" });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível gerar a imagem agora." },
      { status: 502 },
    );
  }

  if (!res.ok) {
    return NextResponse.json(
      { error: "Não foi possível gerar a imagem agora." },
      { status: 502 },
    );
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length === 0) {
    return NextResponse.json(
      { error: "Não foi possível gerar a imagem agora." },
      { status: 502 },
    );
  }

  return NextResponse.json({
    imageDataUrl: `data:image/png;base64,${buffer.toString("base64")}`,
  });
}
