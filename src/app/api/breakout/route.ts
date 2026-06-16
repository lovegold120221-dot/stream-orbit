import { NextRequest, NextResponse } from "next/server";
import { StreamClient } from "@stream-io/node-sdk";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { roomName, numRooms, assignments } = body;

    const apiKey = process.env.STREAM_API_KEY;
    const apiSecret = process.env.STREAM_SECRET_KEY;

    if (!apiKey || !apiSecret) {
      return NextResponse.json({ error: "Stream credentials not configured" }, { status: 500 });
    }

    const client = new StreamClient(apiKey, apiSecret);

    if (!assignments || !roomName) {
      // Ending breakout rooms: receive action="stop" with breakoutRooms
      const { breakoutRooms, originalRoom } = body;
      if (breakoutRooms && Array.isArray(breakoutRooms)) {
        // End each breakout room by sending a custom event and deleting the room
        for (const bRoom of breakoutRooms) {
          try {
            const token = client.createToken("admin-bot");
            // Notify participants via custom event
            await fetch(
              `https://video.stream-io-api.com/api/v2/calls/default/${bRoom}/custom?api_key=${apiKey}`,
              {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${token}`,
                  "stream-auth-type": "jwt",
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  type: "BREAKOUT_END",
                  originalRoom: originalRoom || roomName,
                }),
              }
            );
          } catch (e) {
            console.warn(`Failed to end breakout room ${bRoom}:`, e);
          }

          // End the call
          try {
            const token = client.createToken("admin-bot");
            await fetch(
              `https://video.stream-io-api.com/api/v2/calls/default/${bRoom}?api_key=${apiKey}`,
              {
                method: "PATCH",
                headers: {
                  "Authorization": `Bearer ${token}`,
                  "stream-auth-type": "jwt",
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  ended_at: new Date().toISOString(),
                }),
              }
            );
          } catch (e) {
            console.warn(`Failed to delete breakout room ${bRoom}:`, e);
          }
        }
        return NextResponse.json({ success: true, endedRooms: breakoutRooms });
      }
      return NextResponse.json({ error: "Missing assignments or breakoutRooms" }, { status: 400 });
    }

    // Start breakout rooms
    const createdRooms: string[] = [];

    for (const assignment of assignments) {
      const { identity, displayName = identity, newRoom } = assignment;
      if (!identity || !newRoom) continue;

      if (!createdRooms.includes(newRoom)) {
        // Create the breakout room via Stream API
        try {
          const token = client.createToken("admin-bot");
          const res = await fetch(
            `https://video.stream-io-api.com/api/v2/calls/default/${newRoom}?api_key=${apiKey}`,
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${token}`,
                "stream-auth-type": "jwt",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                created_by_id: "admin-bot",
                custom: {
                  is_breakout: true,
                  original_room: roomName,
                },
              }),
            }
          );
          if (!res.ok) {
            console.warn(`Failed to create breakout room ${newRoom}: ${res.status}`);
          } else {
            createdRooms.push(newRoom);
          }
        } catch (e) {
          console.warn(`Failed to create breakout room ${newRoom}:`, e);
        }
      }

      // Generate token for the breakout participant
      const breakoutIdentity = `${identity}-breakout`;
      const breakoutToken = client.createToken(breakoutIdentity);

      // Send the join instruction via custom event to the participant
      try {
        const token = client.createToken("admin-bot");
        await fetch(
          `https://video.stream-io-api.com/api/v2/calls/default/${roomName}/custom?api_key=${apiKey}`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token}`,
              "stream-auth-type": "jwt",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              type: "BREAKOUT_JOIN",
              newRoom,
              originalRoom: roomName,
              token: breakoutToken,
              serverUrl: "",
              breakoutIdentity,
            }),
          }
        );
      } catch (e) {
        console.warn(`Failed to send breakout join event:`, e);
      }
    }

    return NextResponse.json({ success: true, rooms: createdRooms });
  } catch (error) {
    console.error("Breakout API Error:", error);
    const message = error instanceof Error ? error.message : "Failed to process breakout request.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
