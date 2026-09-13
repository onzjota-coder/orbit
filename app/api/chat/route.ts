import { NextResponse } from "next/server";

const DAILY_LIMIT = 10;

// Lista de modelos em ordem de preferência.
// Se um estiver sobrecarregado (503), tenta o próximo automaticamente.
const MODELS = [
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
  "gemini-2.5-flash",
];

async function callGemini(contents: object[], systemText: string) {
  let lastError = "";

  for (const model of MODELS) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY ?? "",
        },
        body: JSON.stringify({
          contents,
          systemInstruction: {
            parts: [{ text: systemText }],
          },
        }),
      }
    );

    if (res.ok) {
      const data = await res.json();
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (reply) return { ok: true as const, reply };
      lastError = "resposta vazia";
      continue;
    }

    const errText = await res.text();
    console.error(`ERRO GEMINI (${model}):`, res.status, errText);
    lastError = `${res.status}`;

    // 503 = sobrecarregado → tenta o próximo modelo
    // 429 = cota batida → também vale tentar outro
    if (res.status !== 503 && res.status !== 429) break;
  }

  return { ok: false as const, error: lastError };
}

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

    const systemText =
      "Você é o Orbit, um assistente executivo: respostas precisas, diretas e profissionais, sempre em português do Brasil. Sem emojis, sem enrolação. Você é a prévia do Orbit Core, um app que reunirá todas as principais IAs em um único chat.";

    const result = await callGemini(contents, systemText);

    if (!result.ok) {
      return NextResponse.json(
        { error: "A IA está com alta demanda agora. Aguarde alguns segundos e tente novamente." },
        { status: 502 }
      );
    }

    return NextResponse.json({ reply: result.reply, limit: DAILY_LIMIT });
  } catch {
    return NextResponse.json({ error: "Erro inesperado." }, { status: 500 });
  }
}