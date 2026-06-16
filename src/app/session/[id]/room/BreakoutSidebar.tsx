"use client";

import { useCall, useCallStateHooks } from "@stream-io/video-react-sdk";
import { useState } from "react";

export default function BreakoutSidebar({ onClose }: { onClose: () => void }) {
  const call = useCall();
  const { useLocalParticipant, useParticipants } = useCallStateHooks();
  const localParticipant = useLocalParticipant();
  const participants = useParticipants();
  const [loading, setLoading] = useState(false);
  const [activeBreakoutRooms, setActiveBreakoutRooms] = useState<string[]>([]);
  const [numRooms, setNumRooms] = useState(2);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleStartBreakout = async () => {
    setLoading(true);
    setStatusMsg(null);
    try {
      // Exclude local participant (host stays in main room)
      const remoteParticipants = participants.filter(p => !p.isLocalParticipant);
      if (remoteParticipants.length === 0) {
        setStatusMsg("No other participants to assign to breakout rooms.");
        setLoading(false);
        return;
      }

      const roomId = call?.id ?? "";
      const assignments: { identity: string; newRoom: string; displayName: string }[] = [];
      
      remoteParticipants.forEach((p, index) => {
        const roomSuffix = (index % numRooms) + 1;
        assignments.push({
          identity: p.userId,
          displayName: p.name || p.userId,
          newRoom: `${roomId}-breakout-${roomSuffix}`,
        });
      });

      const res = await fetch("/api/breakout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomName: roomId,
          numRooms,
          assignments,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        setStatusMsg(err.error || "Failed to create breakout rooms");
        setLoading(false);
        return;
      }

      const data = await res.json();
      setActiveBreakoutRooms(data.rooms || []);
      setStatusMsg(`Breakout rooms created: ${(data.rooms || []).length} rooms`);
      setLoading(false);
    } catch (e) {
      setStatusMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
      setLoading(false);
    }
  };

  const handleEndAllBreakouts = async () => {
    if (!call) return;
    setLoading(true);
    try {
      await call.sendCustomEvent({
        type: "BREAKOUT_END",
        originalRoom: call.id,
      });
      setActiveBreakoutRooms([]);
      setStatusMsg("Breakout sessions ended. Participants will return.");
      setLoading(false);
    } catch (e) {
      setStatusMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
      setLoading(false);
    }
  };

  return (
    <div className="sidebar-panel">
      <div className="sidebar-header">
        <span>Breakout Rooms</span>
        <button className="sidebar-close" onClick={onClose} aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="sidebar-body">
        <div className="breakout-controls">
          <label className="breakout-label">
            Number of rooms:
            <select
              value={numRooms}
              onChange={(e) => setNumRooms(Number(e.target.value))}
              className="breakout-select"
              disabled={loading}
            >
              {[2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>{n} rooms</option>
              ))}
            </select>
          </label>

          <button
            className="btn btn-primary"
            onClick={handleStartBreakout}
            disabled={loading}
          >
            {loading ? "Creating..." : "Start Breakout Rooms"}
          </button>

          {activeBreakoutRooms.length > 0 && (
            <button
              className="btn btn-outline"
              onClick={handleEndAllBreakouts}
              disabled={loading}
            >
              End All Breakouts
            </button>
          )}

          {statusMsg && (
            <div className="breakout-status">{statusMsg}</div>
          )}
        </div>

        {activeBreakoutRooms.length > 0 && (
          <div className="breakout-rooms-list">
            <h4>Active Breakout Rooms</h4>
            {activeBreakoutRooms.map((room, i) => (
              <div key={i} className="breakout-room-item">
                <span>{room}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
