import { NextRequest, NextResponse } from "next/server";
import { StreamClient } from "@stream-io/node-sdk";
import { STREAM_CALL_TYPE } from "@/lib/config";

// Session caps (mirrors src/lib/config.ts on the client). Hardcoded here to
// avoid a runtime import cycle; keep these in sync if you change them in one place.
const SESSION_TTL_SECONDS = 4 * 60 * 60; // 4h hard cap
const MAX_PARTICIPANTS = 40;

export async function GET(req: NextRequest) {
  const room = req.nextUrl.searchParams.get("room");
  const identity = req.nextUrl.searchParams.get("identity");
  const hostParam = req.nextUrl.searchParams.get("host");
  const isHost = hostParam === "true";
  const displayName =
    req.nextUrl.searchParams.get("name")?.trim() || identity || "";

  if (!room || !identity) {
    return NextResponse.json(
      { error: "Missing room or identity parameter" },
      { status: 400 },
    );
  }

  const apiKey = process.env.STREAM_API_KEY;
  const apiSecret = process.env.STREAM_SECRET_KEY;

  if (!apiKey || !apiSecret) {
    return NextResponse.json(
      { error: "Stream credentials not configured" },
      { status: 500 },
    );
  }

  // Create a Stream client for server-side token generation.
  const client = new StreamClient(apiKey, apiSecret);

  // Generate a user token. The role determines permissions in the call.
  // Admins get moderator capabilities; regular users get member.
  const role = isHost ? "admin" : "user";
  const token = client.createToken(
    identity,
    Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  );

  // Upsert the user with metadata so display name + custom data are available
  // to all participants. Idempotent — upserting the same user is a no-op.
  try {
    await fetch(`https://video.stream-io-api.com/api/v2/users?api_key=${apiKey}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "stream-auth-type": "jwt",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        users: {
          [identity]: {
            id: identity,
            role: role,
            name: displayName,
            custom: {
              lang: "", // will be set when participant chooses language
              host: isHost ? "true" : "",
            },
          },
        },
      }),
    });
  } catch {
    // Non-fatal: user might already exist or network issue; token is still valid.
    console.warn("[token] Could not upsert user on Stream — continuing with token only.");
  }

  return NextResponse.json({
    token,
    apiKey,
    callType: STREAM_CALL_TYPE,
    callId: room,
  });
}
