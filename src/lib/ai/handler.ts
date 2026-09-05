import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createOpenAiClient, AI_MODEL } from "@/lib/openai/client";
import { buildCashflowContext, buildInvestmentContext } from "@/lib/ai/context";
import { CASHFLOW_SYSTEM_PROMPT, INVESTMENT_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import type { AdvisorType } from "@/types";

export async function handleAdvisorChat(request: NextRequest, advisorType: AdvisorType) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY belum dikonfigurasi di server." },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { conversationId?: string; message?: string };
  const message = body.message?.trim();

  if (!message) {
    return NextResponse.json({ error: "Pesan tidak boleh kosong." }, { status: 400 });
  }

  let conversationId = body.conversationId;

  if (conversationId) {
    const { data: existing } = await supabase
      .from("ai_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!existing) conversationId = undefined;
  }

  if (!conversationId) {
    const { data: created, error } = await supabase
      .from("ai_conversations")
      .insert({ user_id: user.id, advisor_type: advisorType, title: message.slice(0, 60) })
      .select("id")
      .single();
    if (error || !created) {
      return NextResponse.json({ error: "Gagal membuat percakapan." }, { status: 500 });
    }
    conversationId = created.id;
  }

  await supabase
    .from("ai_messages")
    .insert({ conversation_id: conversationId, user_id: user.id, role: "user", content: message });

  const { data: historyRows } = await supabase
    .from("ai_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(30);

  const context =
    advisorType === "cashflow"
      ? await buildCashflowContext(supabase, user.id)
      : await buildInvestmentContext(supabase, user.id);

  const systemPrompt = advisorType === "cashflow" ? CASHFLOW_SYSTEM_PROMPT : INVESTMENT_SYSTEM_PROMPT;

  if (!conversationId) {
    return NextResponse.json({ error: "Gagal membuat percakapan." }, { status: 500 });
  }

  const openai = createOpenAiClient();
  const finalConversationId: string = conversationId;

  const completionStream = await openai.chat.completions.create({
    model: AI_MODEL,
    stream: true,
    messages: [
      { role: "system", content: `${systemPrompt}\n\nKonteks data user:\n${context}` },
      ...(historyRows ?? []).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content as string,
      })),
    ],
  });

  const encoder = new TextEncoder();
  let fullText = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of completionStream) {
          const delta = chunk.choices[0]?.delta?.content ?? "";
          if (delta) {
            fullText += delta;
            controller.enqueue(encoder.encode(delta));
          }
        }
      } catch (err) {
        controller.error(err);
        return;
      }

      if (fullText.trim()) {
        await supabase.from("ai_messages").insert({
          conversation_id: finalConversationId,
          user_id: user.id,
          role: "assistant",
          content: fullText,
        });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Conversation-Id": finalConversationId,
    },
  });
}
