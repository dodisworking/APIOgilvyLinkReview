import { NextResponse } from "next/server";

interface AiEmailBody {
  mode: "suggest" | "polish";
  message?: string;
  videoTitle: string;
  version: string;
  frameUrl: string;
  allLinksUrl: string;
  dueText?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AiEmailBody;
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured." },
        { status: 400 },
      );
    }

    const due = body.dueText?.trim() || "not set";
    const baseMessage =
      body.message?.trim() ||
      "Hey team, we have a new posting. Please review and share feedback by the requested deadline.";

    const instruction =
      body.mode === "suggest"
        ? "Write a concise, professional email to request review feedback."
        : "Rewrite the message so it is cleaner, clearer, and more professional while keeping the same intent.";

    const prompt = `
${instruction}

Requirements:
- Keep under 120 words.
- Include a direct review link and an all-links tracking link.
- Mention the feedback deadline clearly.
- Friendly but direct tone.
- Return plain text only.

Context:
- Video: ${body.videoTitle}
- Version: ${body.version}
- Feedback due: ${due}
- Direct link: ${body.frameUrl}
- All links page: ${body.allLinksUrl}
- Draft message: ${baseMessage}
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content:
              "You write short, clear production review emails with actionable deadlines and links.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    const result = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      return NextResponse.json(
        { error: result.error?.message ?? "OpenAI request failed." },
        { status: 500 },
      );
    }

    const message = result.choices?.[0]?.message?.content?.trim();
    if (!message) {
      return NextResponse.json(
        { error: "No AI message generated." },
        { status: 500 },
      );
    }

    return NextResponse.json({ message });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown AI email failure.",
      },
      { status: 500 },
    );
  }
}
