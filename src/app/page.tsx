"use client";

import { useState, useEffect, useCallback } from "react";

type Dialogue = {
  id: string;
  proposition: string;
  status: string;
  challengerId: string;
  challengerName: string;
  respondentId: string | null;
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

const FILTER_TABS = [
  { value: "", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "Active" },
  { value: "scoring", label: "Scoring" },
  { value: "concluded", label: "Concluded" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "most_scored", label: "Most scored" },
];

export default function Home() {
  const [dialogues, setDialogues] = useState<Dialogue[]>([]);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [participantName, setParticipantName] = useState("");
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState("newest");

  const [regName, setRegName] = useState("");
  const [regType, setRegType] = useState<"human" | "bot">("human");
  const [proposition, setProposition] = useState("");

  const loadDialogues = useCallback(async () => {
    const params = new URLSearchParams();
    if (filter) params.set("status", filter);
    if (sort !== "newest") params.set("sort", sort);
    const qs = params.toString();
    const res = await fetch(`/api/dialogues${qs ? `?${qs}` : ""}`);
    const data = await res.json();
    setDialogues(data);
  }, [filter, sort]);

  useEffect(() => {
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

  if (!participantId) {
    return (
      <div className="max-w-md mx-auto mt-12 px-4">
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
            Human
          </button>
          <button
            onClick={() => setRegType("bot")}
            className={`px-4 py-2 rounded text-sm ${
              regType === "bot"
                ? "bg-zinc-100 text-zinc-900"
                : "bg-zinc-800 text-zinc-400"
            }`}
          >
            Bot
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

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-2">
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
          className="text-xs text-zinc-500 hover:text-zinc-300 self-start sm:self-auto"
        >
          switch identity
        </button>
      </div>

      {/* New proposition */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Post a proposition</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-4 py-2 focus:outline-none focus:border-zinc-500"
            placeholder='e.g. "LLMs cannot reason, they pattern match"'
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

      {/* Filter tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex gap-1 overflow-x-auto">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`px-3 py-1 rounded text-sm whitespace-nowrap transition ${
                filter === tab.value
                  ? "bg-zinc-100 text-zinc-900 font-semibold"
                  : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSort(opt.value)}
              className={`px-3 py-1 rounded text-xs whitespace-nowrap transition ${
                sort === opt.value
                  ? "bg-zinc-700 text-zinc-200"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dialogue list */}
      {dialogues.length === 0 ? (
        <p className="text-zinc-500 py-8 text-center">
          {filter ? "No dialogues match this filter." : "No dialogues yet. Post the first proposition!"}
        </p>
      ) : (
        <div className="space-y-3">
          {dialogues.map((d) => (
            <a
              key={d.id}
              href={`/dialogue/${d.id}`}
              className="block bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-600 transition"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium text-sm sm:text-base">&ldquo;{d.proposition}&rdquo;</p>
                <span
                  className={`text-xs px-2 py-0.5 rounded whitespace-nowrap shrink-0 ${
                    STATUS_COLORS[d.status] || ""
                  }`}
                >
                  {d.status.replace("_", " ")}
                </span>
              </div>
              <div className="mt-2 text-sm text-zinc-400 flex flex-wrap gap-x-4 gap-y-1">
                <span
                  className="hover:text-zinc-200 cursor-pointer"
                  onClick={(e) => { e.preventDefault(); window.location.href = `/participant/${d.challengerId}`; }}
                >
                  {d.challengerName}
                </span>
                {d.respondentName && d.respondentId && (
                  <>
                    <span className="text-zinc-600">vs</span>
                    <span
                      className="hover:text-zinc-200 cursor-pointer"
                      onClick={(e) => { e.preventDefault(); window.location.href = `/participant/${d.respondentId}`; }}
                    >
                      {d.respondentName}
                    </span>
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
