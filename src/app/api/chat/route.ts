import connectDB from "@/lib/db";
import Setting from "@/models/setting.model";
import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

function setCorsHeaders(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return res;
}

export async function POST(req: NextRequest) {
  try {
    const { messageHistory, userId } = await req.json();

    if (!messageHistory || !Array.isArray(messageHistory) || messageHistory.length === 0 || !userId) {
      const res = NextResponse.json({ success: false, message: "Message history and User ID are required" }, { status: 400 });
      return setCorsHeaders(res);
    }

    // Extract the latest query the user typed at the end of the history stack
    const latestUserMessage = messageHistory[messageHistory.length - 1]?.parts?.[0]?.text || "";

    await connectDB();

    const setting = await Setting.findOne({ userId });
    if (!setting) {
      const res = NextResponse.json({ success: false, message: "Chatbot configuration missing for this user" }, { status: 404 });
      return setCorsHeaders(res);
    }

    const KNOWLEDGE = `
    business name: ${setting.businessName || "not provided"}
    business email: ${setting.businessEmail || "not provided"}
    knowledge:  ${setting.knowledge || "not provided"}
    `;

    const prompt = `You are a professional customer support assistant for this business.
    
    Use ONLY the information provided below to answer the customer's questions.
    You may rephrase, summarise, or interpret the information if needed.
    Do NOT invent new policies, prices, or promises.
    
    If the customer's question is unrelated to the information, or cannot be reasonably answered from it, reply exactly with: "Please contact support: ${setting.businessEmail}"
    --------------------
    BUSINESS INFORMATION
    --------------------
    ${KNOWLEDGE}

    --------------------
    CUSTOMER QUESTION
    --------------------
    ${latestUserMessage}
    
    --------------------
    ANSWER
    --------------------
    `;

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    const botReply = response.text || `Please contact support: ${setting.businessEmail}`;

    const res = NextResponse.json({
      success: true,
      message: "Reply generated successfully",
      data: {
        reply: botReply
      }
    });
    
    return setCorsHeaders(res);
  } catch (error: any) {
    console.error("API Route Error [/api/chat]:", error);
    const res = NextResponse.json(
      { success: false, message: `Chat processing error: ${error.message || error}` },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}

export const OPTIONS = async () => {
  const res = new NextResponse(null, { status: 204 });
  return setCorsHeaders(res);
};
