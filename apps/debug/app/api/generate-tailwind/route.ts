import { generateTailwindv4FromFigma } from "backend";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { figmaApiKey, fileId, nodeIds } = body;
    
    console.log("Parameters", body)

    if (!figmaApiKey || !fileId || nodeIds.length === 0) {
      return NextResponse.json(
        { error: "Missing or invalid parameters [12]: figmaApiKey, fileId, nodeIds" },
        { status: 400 }
      );
    }
    console.log("API BODY IS GOOD", figmaApiKey)

    const code = await generateTailwindv4FromFigma(figmaApiKey, fileId, nodeIds);

    // return NextResponse.json({ "code" : 200 }, { status: 200 });
    return NextResponse.json({ code }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error", status: false }, { status: 500 });
  }
}
