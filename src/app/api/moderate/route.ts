import { NextRequest, NextResponse } from "next/server";
import { StreamClient } from "@stream-io/node-sdk";

export async function POST(req: NextRequest) {
  try {
    const { action, roomName, identity } = await req.json();

    if (!action || !roomName || !identity) {
      return NextResponse.json(
        { error: "Missing required parameters (action, roomName, identity)" },
        { status: 400 }
      );
    }

    const apiKey = process.env.STREAM_API_KEY;
    const apiSecret = process.env.STREAM_SECRET_KEY;

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "Stream credentials not configured" },
        { status: 500 }
      );
    }

    const client = new StreamClient(apiKey, apiSecret);

    if (action === "kick") {
      try {
        // Block the user from the call
        const token = client.createToken("admin-bot");
        await fetch(
          `https://video.stream-io-api.com/api/v2/calls/default/${roomName}/block?api_key=${apiKey}`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token}`,
              "stream-auth-type": "jwt",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              user_id: identity,
            }),
          }
        );
        return NextResponse.json({ success: true, action: "kick" });
      } catch (err: any) {
        return NextResponse.json(
          { error: err.message || "Failed to kick participant" },
          { status: 500 }
        );
      }
    } else if (action === "mute") {
      try {
        const token = client.createToken("admin-bot");
        await fetch(
          `https://video.stream-io-api.com/api/v2/calls/default/${roomName}/mute_users?api_key=${apiKey}`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token}`,
              "stream-auth-type": "jwt",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              user_ids: [identity],
              audio: true,
              video: false,
              screenshare: false,
            }),
          }
        );
        return NextResponse.json({ success: true, action: "mute" });
      } catch (err: any) {
        return NextResponse.json(
          { error: err.message || "Failed to mute participant" },
          { status: 500 }
        );
      }
    } else if (action === "muteAll") {
      return NextResponse.json(
        { error: "muteAll is not supported via Stream API — use client-side controls" },
        { status: 400 }
      );
    } else {
      return NextResponse.json(
        { error: "Invalid action" },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error("Moderation API Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process moderation request" },
      { status: 500 }
    );
  }
}
