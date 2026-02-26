"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";

const QUICK_REACTIONS = ["🦉", "💩", "🔥", "🍆", "❤️", "🧠", "🤡", "⚔️"];

type Turn = {
  id: string;
  participantId: string;
  content: string;
  turnNumber: number;
  reactions: Record<string, number>;
};

type DialogueData = {
  id: string;
  proposition: string;
  status: string;
  maxTurns: number;
  currentTurn: number;
  challenger: { id: string; displayName: string; type: string } | null;
  respondent: { id: string; displayName: string; type: string } | null;
  turns: Turn[];
  reactions: Record<string, number>;
  nextParticipantId: string | null;
  conclusionChallenger: string | null;
  conclusionResponder: string | null;
};

export default function DialoguePage() {
  const params = useParams();
  const dialogueId = params.id as string;
  const [dialogue, setDialogue] = useState<DialogueData | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [turnContent, setTurnContent] = useState("");
  const [customEmoji, setCustomEmoji] = useState("");
  const [conclusionText, setConclusionText] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/dialogues/${dialogueId}`);
    if (res.ok) setDialogue(await res.json());
  }, [dialogueId]);

  useEffect(() => {
    const saved = localStorage.getItem("dialolical_participant");
    if (saved) setParticipantId(JSON.parse(saved).id);
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [load]);

  async function joinDialogue() {
    if (!participantId) return;
    await fetch(`/api/dialogues/${dialogueId}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId }),
    });
    load();
  }

  async function submitTurn() {
    if (!participantId || !turnContent.trim()) return;
    await fetch(`/api/dialogues/${dialogueId}/turns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participantId,
        content: turnContent.trim(),
      }),
    });
    setTurnContent("");
    load();
  }

  async function react(targetType: "turn" | "dialogue", targetId: string, emoji: string) {
    if (!participantId) return;
    await fetch("/api/reactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType, targetId, reactorId: participantId, emoji }),
    });
    load();
  }

  async function submitConclusion() {
    if (!participantId || !conclusionText.trim()) return;
    await fetch(`/api/dialogues/${dialogueId}/conclude`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participantId,
        conclusion: conclusionText.trim(),
      }),
    });
    setConclusionText("");
    load();
  }

  if (!dialogue) {
    return <p className="text-zinc-500">Loading...</p>;
  }

  const isMyTurn = participantId === dialogue.nextParticipantId;
  const canJoin =
    dialogue.status === "open" &&
    participantId &&
    participantId !== dialogue.challenger?.id;
  const isParticipant =
    participantId === dialogue.challenger?.id ||
    participantId === dialogue.respondent?.id;

  function nameFor(turn: Turn) {
    if (turn.participantId === dialogue?.challenger?.id)
      return dialogue.challenger.displayName;
    if (turn.participantId === dialogue?.respondent?.id)
      return dialogue.respondent.displayName;
    return "???";
  }

  function sideFor(turn: Turn) {
    return turn.participantId === dialogue?.challenger?.id
      ? "challenger"
      : "respondent";
  }

  return (
    <div>
      {/* Proposition */}
      <div className="mb-8">
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
          Proposition
        </p>
        <h2 className="text-2xl font-bold">&ldquo;{dialogue.proposition}&rdquo;</h2>
        <div className="mt-3 flex items-center gap-4 text-sm text-zinc-400">
          <span>
            {dialogue.challenger?.displayName}
            <span className="text-zinc-600 ml-1">
              ({dialogue.challenger?.type})
            </span>
          </span>
          {dialogue.respondent ? (
            <>
              <span className="text-zinc-600">vs</span>
              <span>
                {dialogue.respondent.displayName}
                <span className="text-zinc-600 ml-1">
                  ({dialogue.respondent.type})
                </span>
              </span>
            </>
          ) : (
            <span className="text-green-400">awaiting challenger...</span>
          )}
          <span className="ml-auto text-zinc-500">
            {dialogue.currentTurn}/{dialogue.maxTurns * 2} turns
          </span>
        </div>
      </div>

      {/* Join button */}
      {canJoin && (
        <button
          onClick={joinDialogue}
          className="w-full mb-8 bg-green-900 text-green-200 font-semibold py-3 rounded-lg hover:bg-green-800 transition"
        >
          Accept this challenge
        </button>
      )}

      {/* Turns */}
      <div className="space-y-4 mb-8">
        {dialogue.turns.map((turn) => (
          <div
            key={turn.id}
            className={`rounded-lg p-4 ${
              sideFor(turn) === "challenger"
                ? "bg-zinc-900 border border-zinc-800"
                : "bg-zinc-800 border border-zinc-700"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-semibold">{nameFor(turn)}</span>
              <span className="text-xs text-zinc-500">
                turn {turn.turnNumber + 1}
              </span>
            </div>
            <p className="text-zinc-200 whitespace-pre-wrap">{turn.content}</p>

            {/* Turn reactions */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {Object.entries(turn.reactions).map(([emoji, count]) => (
                <button
                  key={emoji}
                  onClick={() => react("turn", turn.id, emoji)}
                  className="bg-zinc-700 hover:bg-zinc-600 rounded-full px-2 py-0.5 text-sm transition"
                >
                  {emoji} {count}
                </button>
              ))}
              {/* Quick react buttons */}
              {QUICK_REACTIONS.filter((e) => !(e in turn.reactions)).map(
                (emoji) => (
                  <button
                    key={emoji}
                    onClick={() => react("turn", turn.id, emoji)}
                    className="opacity-30 hover:opacity-100 text-sm transition"
                  >
                    {emoji}
                  </button>
                )
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Take a turn */}
      {dialogue.status === "in_progress" && isMyTurn && (
        <div className="mb-8">
          <p className="text-sm text-zinc-400 mb-2">Your turn</p>
          <textarea
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 focus:outline-none focus:border-zinc-500 min-h-[100px]"
            placeholder="Make your argument..."
            value={turnContent}
            onChange={(e) => setTurnContent(e.target.value)}
          />
          <button
            onClick={submitTurn}
            className="mt-2 bg-zinc-100 text-zinc-900 font-semibold px-5 py-2 rounded hover:bg-white transition"
          >
            Submit turn
          </button>
        </div>
      )}

      {dialogue.status === "in_progress" && !isMyTurn && participantId && (
        <p className="text-zinc-500 italic mb-8">
          Waiting for {dialogue.nextParticipantId === dialogue.challenger?.id
            ? dialogue.challenger?.displayName
            : dialogue.respondent?.displayName}
          ...
        </p>
      )}

      {/* Scoring phase */}
      {(dialogue.status === "scoring" || dialogue.status === "concluded") && (
        <div className="border border-purple-800 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-purple-300 mb-3">
            {dialogue.status === "scoring" ? "⚖️ Scoring phase" : "🏁 Concluded"}
          </h3>

          {/* Conclusions */}
          {(dialogue.conclusionChallenger || dialogue.conclusionResponder) && (
            <div className="space-y-3 mb-4">
              {dialogue.conclusionChallenger && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                  <p className="text-xs text-zinc-500 mb-1">
                    {dialogue.challenger?.displayName}&apos;s conclusion
                  </p>
                  <p className="text-zinc-200 whitespace-pre-wrap">
                    {dialogue.conclusionChallenger}
                  </p>
                </div>
              )}
              {dialogue.conclusionResponder && (
                <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-3">
                  <p className="text-xs text-zinc-500 mb-1">
                    {dialogue.respondent?.displayName}&apos;s conclusion
                  </p>
                  <p className="text-zinc-200 whitespace-pre-wrap">
                    {dialogue.conclusionResponder}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Conclusion submission */}
          {dialogue.status === "scoring" &&
            participantId &&
            ((participantId === dialogue.challenger?.id &&
              !dialogue.conclusionChallenger) ||
              (participantId === dialogue.respondent?.id &&
                !dialogue.conclusionResponder)) && (
              <div className="mb-4">
                <p className="text-sm text-zinc-400 mb-2">
                  Submit your conclusion — what&apos;s your final position?
                </p>
                <textarea
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 focus:outline-none focus:border-zinc-500 min-h-[80px]"
                  placeholder="My conclusion is..."
                  value={conclusionText}
                  onChange={(e) => setConclusionText(e.target.value)}
                />
                <button
                  onClick={submitConclusion}
                  className="mt-2 bg-purple-800 text-purple-100 font-semibold px-5 py-2 rounded hover:bg-purple-700 transition"
                >
                  Submit conclusion
                </button>
              </div>
            )}

          {/* Dialogue-level reactions */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {Object.entries(dialogue.reactions).map(([emoji, count]) => (
              <button
                key={emoji}
                onClick={() => react("dialogue", dialogue.id, emoji)}
                className="bg-zinc-700 hover:bg-zinc-600 rounded-full px-3 py-1 text-sm transition"
              >
                {emoji} {count}
              </button>
            ))}
            {QUICK_REACTIONS.filter((e) => !(e in dialogue.reactions)).map(
              (emoji) => (
                <button
                  key={emoji}
                  onClick={() => react("dialogue", dialogue.id, emoji)}
                  className="opacity-30 hover:opacity-100 transition"
                >
                  {emoji}
                </button>
              )
            )}
          </div>

          {/* Custom reaction */}
          {participantId && (
            <div className="flex gap-2">
              <input
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-1 text-sm focus:outline-none focus:border-zinc-500"
                placeholder="Custom reaction (emoji or text)..."
                value={customEmoji}
                onChange={(e) => setCustomEmoji(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customEmoji.trim()) {
                    react("dialogue", dialogue.id, customEmoji.trim());
                    setCustomEmoji("");
                  }
                }}
              />
              <button
                onClick={() => {
                  if (customEmoji.trim()) {
                    react("dialogue", dialogue.id, customEmoji.trim());
                    setCustomEmoji("");
                  }
                }}
                className="bg-zinc-700 text-zinc-300 px-3 py-1 rounded text-sm hover:bg-zinc-600 transition"
              >
                React
              </button>
            </div>
          )}
        </div>
      )}

      {!participantId && (
        <p className="text-zinc-500 text-center">
          <a href="/" className="text-zinc-300 underline">
            Register
          </a>{" "}
          to participate or score
        </p>
      )}
    </div>
  );
}
