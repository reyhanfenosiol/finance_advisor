import type { NextRequest } from "next/server";
import { handleAdvisorChat } from "@/lib/ai/handler";

export async function POST(request: NextRequest) {
  return handleAdvisorChat(request, "cashflow");
}
