import { NextResponse } from "next/server";

const DAILY_LIMIT = 10;

export async function POST(req: Request) {
  try {
    const { message, history } = await req.json();

    if (!message || typeof message !== "string" || message.length > 2000) {
      return NextResponse.json({ error: "Mensagem inválida." }, { status: 400 });
    }

    const contents = [
      ...(Array.isArray(history) ? history.slice(-8) : []),
      { role: "user", parts: [{ text: message }] },
    ];

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          systemInstruction: {
            parts: [
              {
                text: "Você é o Orbit, um assistente brasileiro amigável e direto. Responda sempre em português do Brasil, de forma útil e concisa. Você é a prévia do Orbit Core, um app que reunirá todas as IAs em um só lugar.",
              },
            ],
          },
        }),
      }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: "A IA está ocupada. Tente de novo em instantes." },
        { status: 502 }
      );
    }

    const data = await res.json();
    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ??
      "Não consegui responder agora. Tente novamente.";

    return NextResponse.json({ reply, limit: DAILY_LIMIT });
  } catch {
    return NextResponse.json({ error: "Erro inesperado." }, { status: 500 });
  }
}