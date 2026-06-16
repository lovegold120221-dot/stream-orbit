import { NextRequest, NextResponse } from "next/server";
import { StreamClient } from "@stream-io/node-sdk";

/**
 * Recording API for Stream Video.
 * Stream doesn't provide a direct server-side egress API for composite recording —
 * recording is configured at the call-type level in the Stream dashboard and
 * started/stopped by participants with recording permissions.
 *
 * This route provides a thin wrapper that can be extended if server-side
 * recording control becomes available in the Stream Video REST API.
 */
export async function POST(req: NextRequest) {
  try {
    const { action, roomName } = await req.json();

    if (!roomName) {
      return NextResponse.json({ error: "Missing roomName parameter" }, { status: 400 });
    }

    const apiKey = process.env.STREAM_API_KEY;
    const apiSecret = process.env.STREAM_SECRET_KEY;

    if (!apiKey || !apiSecret) {
      return NextResponse.json({ error: "Stream credentials not configured" }, { status: 500 });
    }

    const client = new StreamClient(apiKey, apiSecret);

    if (action === "start") {
      try {
        const token = client.createToken("admin-bot");
        const res = await fetch(
          `https://video.stream-io-api.com/api/v2/calls/default/${roomName}/start_recording?api_key=${apiKey}`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token}`,
              "stream-auth-type": "jwt",
              "Content-Type": "application/json",
            },
          }
        );

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          // Stream might not have this endpoint — recording is configured via dashboard
          return NextResponse.json({
            success: false,
            message: "Server-side recording start is not available via Stream REST API. Use the Stream dashboard to enable call recording.",
            detail: errBody,
          }, { status: 400 });
        }

        const data = await res.json();
        return NextResponse.json({ success: true, ...data });
      } catch (e: any) {
        return NextResponse.json({
          success: false,
          message: "Server-side recording is not available via Stream REST API. Configure recording in the Stream dashboard.",
          error: e.message,
        }, { status: 400 });
      }
    } else if (action === "stop") {
      try {
        const token = client.createToken("admin-bot");
        const res = await fetch(
          `https://video.stream-io-api.com/api/v2/calls/default/${roomName}/stop_recording?api_key=${apiKey}`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token}`,
              "stream-auth-type": "jwt",
              "Content-Type": "application/json",
            },
          }
        );

        if (!res.ok) {
          return NextResponse.json({
            success: false,
            message: "Server-side recording stop is not available via Stream REST API.",
          }, { status: 400 });
        }

        return NextResponse.json({ success: true });
      } catch (e: any) {
        return NextResponse.json({
          success: false,
          message: "Recording stop failed.",
          error: e.message,
        }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: "Invalid action parameter" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Recording API Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process recording request." },
      { status: 500 }
    );
  }
}
