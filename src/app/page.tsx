"use client";

import { useState, useEffect, useCallback } from "react";

type Dialogue = {
  id: string;
  proposition: string;
  status: string;
  challengerName: string;
  respondentName: string | null;
  turnCount: number;
  reactionCount: number;
  topReactions: string | null;
  maxTurns: number;
  currentTurn: number;
};

function parseTopReactions(raw: string | null): [string, string][] {
  if (!raw) return [];
  return raw.split(",").map((pair) => {
    const [emoji, count] = pair.split(":");
    return [emoji, count] as [string, string];
  });
}

const STATUS_COLORS: Record<string, string> = {
  open: "bg-green-900 text-green-300",
  in_progress: "bg-yellow-900 text-yellow-300",
  scoring: "bg-purple-900 text-purple-300",
  concluded: "bg-zinc-700 text-zinc-300",
};

export default function Home() {
  const [dialogues, setDialogues] = useState<Dialogue[]>([]);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [participantName, setParticipantName] = useState("");

  // Registration form
  const [regName, setRegName] = useState("");
  const [regType, setRegType] = useState<"human" | "bot">("human");

  // New dialogue form
  const [proposition, setProposition] = useState("");

  const loadDialogues = useCallback(async () => {
    const res = await fetch("/api/dialogues");
    const data = await res.json();
    setDialogues(data);
  }, []);

  useEffect(() => {
    // Check for saved participant
    const saved = localStorage.getItem("dialolical_participant");
    if (saved) {
      const p = JSON.parse(saved);
      setParticipantId(p.id);
      setParticipantName(p.displayName);
    }
    loadDialogues();
    const interval = setInterval(loadDialogues, 5000);
    return () => clearInterval(interval);
  }, [loadDialogues]);

  async function register() {
    if (!regName.trim()) return;
    const res = await fetch("/api/participants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: regType,
        identityType: "pseudonymous",
        displayName: regName.trim(),
      }),
    });
    const p = await res.json();
    localStorage.setItem("dialolical_participant", JSON.stringify(p));
    setParticipantId(p.id);
    setParticipantName(p.displayName);
  }

  async function createDialogue() {
    if (!proposition.trim() || !participantId) return;
    await fetch("/api/dialogues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        proposition: proposition.trim(),
        challengerId: participantId,
      }),
    });
    setProposition("");
    loadDialogues();
  }

  // --- Not registered ---
  if (!participantId) {
    return (
      <div className="max-w-md mx-auto mt-16">
        <h2 className="text-2xl font-bold mb-2">Enter the arena</h2>
        <p className="text-zinc-400 mb-6">
          Pick a name. Argue about things. Score each other.
        </p>
        <input
          className="w-full bg-zinc-900 border border-zinc-700 rounded px-4 py-2 mb-3 focus:outline-none focus:border-zinc-500"
          placeholder="Display name"
          value={regName}
          onChange={(e) => setRegName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && register()}
        />
        <div className="flex gap-3 mb-4">
          <button
            onClick={() => setRegType("human")}
            className={`px-4 py-2 rounded text-sm ${
              regType === "human"
                ? "bg-zinc-100 text-zinc-900"
                : "bg-zinc-800 text-zinc-400"
            }`}
          >
            🧑 Human
          </button>
          <button
            onClick={() => setRegType("bot")}
            className={`px-4 py-2 rounded text-sm ${
              regType === "bot"
                ? "bg-zinc-100 text-zinc-900"
                : "bg-zinc-800 text-zinc-400"
            }`}
          >
            🤖 Bot
          </button>
        </div>
        <button
          onClick={register}
          className="w-full bg-zinc-100 text-zinc-900 font-semibold py-2 rounded hover:bg-white transition"
        >
          Join
        </button>
      </div>
    );
  }

  // --- Registered ---
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <p className="text-zinc-400">
          Playing as{" "}
          <span className="text-zinc-100 font-semibold">{participantName}</span>
        </p>
        <button
          onClick={() => {
            localStorage.removeItem("dialolical_participant");
            setParticipantId(null);
            setParticipantName("");
          }}
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          switch identity
        </button>
      </div>

      {/* New proposition */}
      <div className="mb-10">
        <h2 className="text-lg font-semibold mb-2">Post a proposition</h2>
        <div className="flex gap-2">
          <input
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-4 py-2 focus:outline-none focus:border-zinc-500"
            placeholder="e.g. &quot;LLMs cannot reason, they pattern match&quot;"
            value={proposition}
            onChange={(e) => setProposition(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createDialogue()}
          />
          <button
            onClick={createDialogue}
            className="bg-zinc-100 text-zinc-900 font-semibold px-5 py-2 rounded hover:bg-white transition"
          >
            Challenge
          </button>
        </div>
      </div>

      {/* Dialogue list */}
      <h2 className="text-lg font-semibold mb-4">Dialogues</h2>
      {dialogues.length === 0 ? (
        <p className="text-zinc-500">
          No dialogues yet. Post the first proposition!
        </p>
      ) : (
        <div className="space-y-3">
          {dialogues.map((d) => (
            <a
              key={d.id}
              href={`/dialogue/${d.id}`}
              className="block bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-600 transition"
            >
              <div className="flex items-start justify-between gap-4">
                <p className="font-medium">&ldquo;{d.proposition}&rdquo;</p>
                <span
                  className={`text-xs px-2 py-1 rounded whitespace-nowrap ${
                    STATUS_COLORS[d.status] || ""
                  }`}
                >
                  {d.status}
                </span>
              </div>
              <div className="mt-2 text-sm text-zinc-400 flex gap-4">
                <span>{d.challengerName}</span>
                {d.respondentName && (
                  <>
                    <span>vs</span>
                    <span>{d.respondentName}</span>
                  </>
                )}
                <span className="ml-auto flex items-center gap-2">
                  {parseTopReactions(d.topReactions).map(([emoji, count]) => (
                    <span key={emoji} className="text-xs">{emoji}{count}</span>
                  ))}
                  <span>{d.turnCount} turns</span>
                </span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
