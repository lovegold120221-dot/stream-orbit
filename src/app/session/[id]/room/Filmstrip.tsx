"use client";

import type { StreamVideoParticipant } from "@stream-io/video-react-sdk";
import ParticipantTile from "./ParticipantTile";

export default function Filmstrip({
  participants,
  myLang,
}: {
  participants: StreamVideoParticipant[];
  myLang: string;
}) {
  if (participants.length === 0) return null;

  return (
    <div className="filmstrip">
      {participants.map((p) => (
        <ParticipantTile key={p.userId} participant={p} myLang={myLang} />
      ))}
    </div>
  );
}
