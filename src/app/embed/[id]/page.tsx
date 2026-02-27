"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";

const STATUS_COLORS: Record<string, string> = {
  open: "bg-green-900 text-green-300",
  in_progress: "bg-yellow-900 text-yellow-300",
  scoring: "bg-purple-900 text-purple-300",
  concluded: "bg-zinc-700 text-zinc-300",
};

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
  conclusionChallenger: string | null;
  conclusionResponder: string | null;
};

export default function EmbedPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const dialogueId = params.id as string;
  const theme = searchParams.get("theme");
  const isLight = theme === "light";

  const [dialogue, setDialogue] = useState<DialogueData | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/dialogues/${dialogueId}`);
    if (res.ok) setDialogue(await res.json());
  }, [dialogueId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  if (!dialogue) {
    return <p className={isLight ? "text-zinc-500" : "text-zinc-500"}>Loading...</p>;
  }

  const bg = isLight ? "bg-white text-zinc-900" : "bg-zinc-950 text-zinc-100";
  const cardBg = isLight ? "bg-zinc-50 border-zinc-200" : "bg-zinc-900 border-zinc-800";
  const cardBgAlt = isLight ? "bg-zinc-100 border-zinc-200" : "bg-zinc-800 border-zinc-700";
  const mutedText = isLight ? "text-zinc-500" : "text-zinc-500";

  const topReactions = Object.entries(dialogue.reactions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className={`${bg} text-sm`}>
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="font-bold text-base">&ldquo;{dialogue.proposition}&rdquo;</p>
          <span className={`text-xs px-2 py-0.5 rounded whitespace-nowrap shrink-0 ${STATUS_COLORS[dialogue.status] || ""}`}>
            {dialogue.status.replace("_", " ")}
          </span>
        </div>
        <div className={`flex items-center gap-2 text-xs ${mutedText}`}>
          <span>{dialogue.challenger?.displayName}</span>
          {dialogue.respondent && (
            <>
              <span>vs</span>
              <span>{dialogue.respondent.displayName}</span>
            </>
          )}
          <span className="ml-auto">{dialogue.currentTurn}/{dialogue.maxTurns * 2} turns</span>
          {topReactions.length > 0 && (
            <span className="flex gap-1">
              {topReactions.map(([emoji, count]) => (
                <span key={emoji}>{emoji}{count}</span>
              ))}
            </span>
          )}
        </div>
      </div>

      {/* Turns */}
      <div className="space-y-2 mb-4">
        {dialogue.turns.map((turn) => {
          const isChallenger = turn.participantId === dialogue.challenger?.id;
          const name = isChallenger ? dialogue.challenger?.displayName : dialogue.respondent?.displayName;
          return (
            <div key={turn.id} className={`rounded p-3 border ${isChallenger ? cardBg : cardBgAlt}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-xs">{name}</span>
                <span className={`text-xs ${mutedText}`}>turn {turn.turnNumber + 1}</span>
              </div>
              <p className="whitespace-pre-wrap text-xs leading-relaxed">{turn.content}</p>
              {Object.keys(turn.reactions).length > 0 && (
                <div className="flex gap-1.5 mt-2">
                  {Object.entries(turn.reactions).map(([emoji, count]) => (
                    <span key={emoji} className={`text-xs ${mutedText}`}>{emoji}{count}</span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Conclusions */}
      {(dialogue.conclusionChallenger || dialogue.conclusionResponder) && (
        <div className="space-y-2 mb-4">
          {dialogue.conclusionChallenger && (
            <div className={`rounded p-3 border ${cardBg}`}>
              <p className={`text-xs ${mutedText} mb-1`}>{dialogue.challenger?.displayName}&apos;s conclusion</p>
              <p className="text-xs whitespace-pre-wrap">{dialogue.conclusionChallenger}</p>
            </div>
          )}
          {dialogue.conclusionResponder && (
            <div className={`rounded p-3 border ${cardBgAlt}`}>
              <p className={`text-xs ${mutedText} mb-1`}>{dialogue.respondent?.displayName}&apos;s conclusion</p>
              <p className="text-xs whitespace-pre-wrap">{dialogue.conclusionResponder}</p>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className={`text-xs ${mutedText} text-center pt-2 border-t ${isLight ? "border-zinc-200" : "border-zinc-800"}`}>
        <a href={`https://dialolical.com/dialogue/${dialogueId}`} target="_blank" rel="noopener" className="hover:underline">
          View on Dialolical
        </a>
      </div>
    </div>
  );
}
