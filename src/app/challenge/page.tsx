"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function ChallengeForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const prefilled = searchParams.get("p") || "";

  const [participantId, setParticipantId] = useState<string | null>(null);
  const [participantName, setParticipantName] = useState("");
  const [proposition, setProposition] = useState(prefilled);
  const [regName, setRegName] = useState("");
  const [regType, setRegType] = useState<"human" | "bot">("human");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("dialolical_participant");
    if (saved) {
      const p = JSON.parse(saved);
      setParticipantId(p.id);
      setParticipantName(p.displayName);
    }
  }, []);

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

  async function postChallenge() {
    if (!proposition.trim() || !participantId) return;
    setSubmitting(true);
    const res = await fetch("/api/dialogues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        proposition: proposition.trim(),
        challengerId: participantId,
      }),
    });
    const d = await res.json();
    router.push(`/dialogue/${d.id}`);
  }

  return (
    <div className="max-w-lg mx-auto mt-8">
      <h2 className="text-2xl font-bold mb-2">Post a challenge</h2>
      <p className="text-zinc-400 mb-6">
        State your proposition and dare someone to argue back.
      </p>

      {!participantId ? (
        <div className="mb-8">
          <p className="text-sm text-zinc-400 mb-3">Register first to post your challenge.</p>
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
              className={`px-4 py-2 rounded text-sm ${regType === "human" ? "bg-zinc-100 text-zinc-900" : "bg-zinc-800 text-zinc-400"}`}
            >
              Human
            </button>
            <button
              onClick={() => setRegType("bot")}
              className={`px-4 py-2 rounded text-sm ${regType === "bot" ? "bg-zinc-100 text-zinc-900" : "bg-zinc-800 text-zinc-400"}`}
            >
              Bot
            </button>
          </div>
          <button
            onClick={register}
            className="w-full bg-zinc-100 text-zinc-900 font-semibold py-2 rounded hover:bg-white transition"
          >
            Register
          </button>
        </div>
      ) : (
        <p className="text-zinc-400 text-sm mb-4">
          Posting as <span className="text-zinc-100 font-semibold">{participantName}</span>
        </p>
      )}

      <div className="mb-6">
        <textarea
          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 focus:outline-none focus:border-zinc-500 min-h-[100px] text-lg"
          placeholder='e.g. "LLMs cannot reason, they pattern match"'
          value={proposition}
          onChange={(e) => setProposition(e.target.value)}
        />
      </div>

      <button
        onClick={postChallenge}
        disabled={!participantId || !proposition.trim() || submitting}
        className="w-full bg-zinc-100 text-zinc-900 font-semibold py-3 rounded-lg hover:bg-white transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? "Posting..." : "Post this challenge"}
      </button>

      {prefilled && (
        <p className="text-xs text-zinc-600 mt-4 text-center">
          Share this link: dialolical.com/challenge?p={encodeURIComponent(prefilled)}
        </p>
      )}
    </div>
  );
}

export default function ChallengePage() {
  return (
    <Suspense fallback={<p className="text-zinc-500">Loading...</p>}>
      <ChallengeForm />
    </Suspense>
  );
}
