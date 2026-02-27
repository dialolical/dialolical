"use client";

import { useState, useEffect, useCallback, useRef } from "react";

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

function topEmojis(reactions: Record<string, number>, n = 3) {
  return Object.entries(reactions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

export default function DialogueView({ dialogueId }: { dialogueId: string }) {
  const [dialogue, setDialogue] = useState<DialogueData | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [turnContent, setTurnContent] = useState("");
  const [customEmoji, setCustomEmoji] = useState("");
  const [conclusionText, setConclusionText] = useState("");
  const [poppedKey, setPoppedKey] = useState<string | null>(null);
  const [turnCustomInputs, setTurnCustomInputs] = useState<Record<string, string>>({});
  const popTimer = useRef<ReturnType<typeof setTimeout>>();

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

  function react(targetType: "turn" | "dialogue", targetId: string, emoji: string) {
    if (!participantId || !dialogue) return;

    // Pop animation
    const key = `${targetId}-${emoji}`;
    setPoppedKey(key);
    if (popTimer.current) clearTimeout(popTimer.current);
    popTimer.current = setTimeout(() => setPoppedKey(null), 300);

    // Optimistic update
    setDialogue((prev) => {
      if (!prev) return prev;
      if (targetType === "turn") {
        return {
          ...prev,
          turns: prev.turns.map((t) =>
            t.id === targetId
              ? { ...t, reactions: { ...t.reactions, [emoji]: (t.reactions[emoji] || 0) + 1 } }
              : t
          ),
        };
      }
      return {
        ...prev,
        reactions: { ...prev.reactions, [emoji]: (prev.reactions[emoji] || 0) + 1 },
      };
    });

    // Fire and forget — polling reconciles
    fetch("/api/reactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType, targetId, reactorId: participantId, emoji }),
    }).catch(() => {
      // Rollback on failure
      setDialogue((prev) => {
        if (!prev) return prev;
        if (targetType === "turn") {
          return {
            ...prev,
            turns: prev.turns.map((t) =>
              t.id === targetId
                ? { ...t, reactions: { ...t.reactions, [emoji]: Math.max((t.reactions[emoji] || 1) - 1, 0) } }
                : t
            ),
          };
        }
        return {
          ...prev,
          reactions: { ...prev.reactions, [emoji]: Math.max((prev.reactions[emoji] || 1) - 1, 0) },
        };
      });
    });
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

  function btnClass(targetId: string, emoji: string, base: string) {
    const key = `${targetId}-${emoji}`;
    return poppedKey === key ? `${base} reaction-pop` : base;
  }

  function renderReactionBar(
    targetType: "turn" | "dialogue",
    targetId: string,
    reactions: Record<string, number>
  ) {
    const customKey = targetType === "dialogue" ? "dialogue" : targetId;
    const customValue = targetType === "dialogue" ? customEmoji : (turnCustomInputs[targetId] || "");
    const setCustomValue = (val: string) => {
      if (targetType === "dialogue") {
        setCustomEmoji(val);
      } else {
        setTurnCustomInputs((prev) => ({ ...prev, [targetId]: val }));
      }
    };
    const submitCustom = () => {
      if (customValue.trim()) {
        react(targetType, targetId, customValue.trim());
        setCustomValue("");
      }
    };

    return (
      <div className="flex flex-wrap items-center gap-2">
        {Object.entries(reactions).map(([emoji, count]) => (
          <button
            key={emoji}
            onClick={() => react(targetType, targetId, emoji)}
            className={btnClass(
              targetId,
              emoji,
              "bg-zinc-700 hover:bg-zinc-600 rounded-full px-2 py-0.5 text-sm transition-all"
            )}
          >
            {emoji} {count}
          </button>
        ))}
        {QUICK_REACTIONS.filter((e) => !(e in reactions)).map((emoji) => (
          <button
            key={emoji}
            onClick={() => react(targetType, targetId, emoji)}
            className={btnClass(
              targetId,
              emoji,
              "opacity-30 hover:opacity-100 text-sm transition-all"
            )}
          >
            {emoji}
          </button>
        ))}
        {participantId && (
          <span className="inline-flex items-center gap-1 ml-1">
            <input
              className="w-24 bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-xs focus:outline-none focus:border-zinc-500 focus:w-40 transition-all"
              placeholder="+ custom"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitCustom()}
            />
          </span>
        )}
      </div>
    );
  }

  const headerTopReactions = topEmojis(dialogue.reactions);

  return (
    <div>
      {/* Proposition */}
      <div className="mb-8">
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
          Proposition
        </p>
        <h2 className="text-2xl font-bold">&ldquo;{dialogue.proposition}&rdquo;</h2>
        <div className="mt-3 flex items-center gap-4 text-sm text-zinc-400">
          <a href={`/participant/${dialogue.challenger?.id}`} className="hover:text-zinc-200 transition">
            {dialogue.challenger?.displayName}
            <span className="text-zinc-600 ml-1">
              ({dialogue.challenger?.type})
            </span>
          </a>
          {dialogue.respondent ? (
            <>
              <span className="text-zinc-600">vs</span>
              <a href={`/participant/${dialogue.respondent.id}`} className="hover:text-zinc-200 transition">
                {dialogue.respondent.displayName}
                <span className="text-zinc-600 ml-1">
                  ({dialogue.respondent.type})
                </span>
              </a>
            </>
          ) : (
            <span className="text-green-400">awaiting challenger...</span>
          )}
          <span className="ml-auto flex items-center gap-3 text-zinc-500">
            {headerTopReactions.length > 0 && (
              <span className="flex gap-1.5">
                {headerTopReactions.map(([emoji, count]) => (
                  <span key={emoji} className="text-xs">{emoji}{count}</span>
                ))}
              </span>
            )}
            <span>{dialogue.currentTurn}/{dialogue.maxTurns * 2} turns</span>
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
            <div className="mt-3">
              {renderReactionBar("turn", turn.id, turn.reactions)}
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

      {/* Dialogue-level scoring — available in all active states */}
      {dialogue.status !== "open" && (
        <div className="border border-zinc-800 rounded-lg p-6 mb-8">
          {/* Conclusions section (scoring/concluded only) */}
          {(dialogue.status === "scoring" || dialogue.status === "concluded") && (
            <>
              <h3 className="text-lg font-semibold text-purple-300 mb-3">
                {dialogue.status === "scoring" ? "⚖️ Scoring phase" : "🏁 Concluded"}
              </h3>

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
            </>
          )}

          {/* Dialogue-level reactions — always visible when not open */}
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
            Score this dialogue
          </p>
          {renderReactionBar("dialogue", dialogue.id, dialogue.reactions)}
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

      {/* Share */}
      <div className="border-t border-zinc-800 pt-4 mt-8 flex flex-wrap gap-3 text-xs">
        <button
          onClick={() => {
            navigator.clipboard.writeText(`https://dialolical.com/dialogue/${dialogueId}`);
          }}
          className="bg-zinc-800 text-zinc-400 hover:text-zinc-200 px-3 py-1.5 rounded transition"
        >
          Copy link
        </button>
        <button
          onClick={() => {
            navigator.clipboard.writeText(
              `<iframe src="https://dialolical.com/embed/${dialogueId}" width="100%" height="500" frameborder="0"></iframe>`
            );
          }}
          className="bg-zinc-800 text-zinc-400 hover:text-zinc-200 px-3 py-1.5 rounded transition"
        >
          Copy embed code
        </button>
        <a
          href={`/challenge?p=${encodeURIComponent(dialogue?.proposition || "")}`}
          className="bg-zinc-800 text-zinc-400 hover:text-zinc-200 px-3 py-1.5 rounded transition"
        >
          Start new debate on this topic
        </a>
      </div>
    </div>
  );
}
