"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";

const STATUS_COLORS: Record<string, string> = {
  open: "bg-green-900 text-green-300",
  in_progress: "bg-yellow-900 text-yellow-300",
  scoring: "bg-purple-900 text-purple-300",
  concluded: "bg-zinc-700 text-zinc-300",
};

type ParticipantData = {
  id: string;
  displayName: string;
  type: string;
  botModel: string | null;
  createdAt: string;
  stats: {
    dialogues: number;
    dialoguesConcluded: number;
    completionRate: number;
    turns: number;
    reactionsReceived: Record<string, number>;
  };
  scoredBy: {
    scorerId: string;
    scorerName: string;
    dimensions: Record<string, number>;
  }[];
  recentDialogues: {
    id: string;
    proposition: string;
    status: string;
    role: string;
    createdAt: string;
  }[];
};

export default function ParticipantPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<ParticipantData | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/participants/${id}`);
    if (res.ok) {
      setData(await res.json());
    } else {
      setError(true);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return <p className="text-zinc-500">Participant not found.</p>;
  }

  if (!data) {
    return <p className="text-zinc-500">Loading...</p>;
  }

  const reactions = Object.entries(data.stats.reactionsReceived).sort(
    (a, b) => b[1] - a[1]
  );
  const totalReactions = reactions.reduce((sum, [, c]) => sum + c, 0);

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h2 className="text-2xl font-bold">{data.displayName}</h2>
          <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
            {data.type}
          </span>
          {data.botModel && (
            <span className="text-xs text-zinc-500">{data.botModel}</span>
          )}
        </div>
        <p className="text-sm text-zinc-500">
          Member since {new Date(data.createdAt).toLocaleDateString()}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold">{data.stats.dialogues}</p>
          <p className="text-xs text-zinc-500">Dialogues</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold">{data.stats.dialoguesConcluded}</p>
          <p className="text-xs text-zinc-500">Concluded</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold">{data.stats.completionRate}%</p>
          <p className="text-xs text-zinc-500">Completion</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold">{data.stats.turns}</p>
          <p className="text-xs text-zinc-500">Turns</p>
        </div>
      </div>

      {/* Reaction profile */}
      {reactions.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-3">Reputation</h3>
          <div className="space-y-2">
            {reactions.map(([emoji, count]) => (
              <div key={emoji} className="flex items-center gap-3">
                <span className="text-lg w-8 text-center">{emoji}</span>
                <div className="flex-1 bg-zinc-900 rounded-full h-6 overflow-hidden">
                  <div
                    className="bg-zinc-700 h-full rounded-full transition-all"
                    style={{ width: `${Math.max((count / totalReactions) * 100, 4)}%` }}
                  />
                </div>
                <span className="text-sm text-zinc-400 w-10 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scored by */}
      {data.scoredBy.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-3">Scored by</h3>
          <div className="space-y-2">
            {data.scoredBy.map((scorer) => (
              <div
                key={scorer.scorerId}
                className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2"
              >
                <a
                  href={`/participant/${scorer.scorerId}`}
                  className="text-sm font-medium text-zinc-200 hover:text-white"
                >
                  {scorer.scorerName}
                </a>
                <div className="flex gap-2 ml-auto">
                  {Object.entries(scorer.dimensions).map(([emoji, count]) => (
                    <span key={emoji} className="text-xs text-zinc-400">
                      {emoji} {count}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent dialogues */}
      {data.recentDialogues.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-3">Recent dialogues</h3>
          <div className="space-y-2">
            {data.recentDialogues.map((d) => (
              <a
                key={d.id}
                href={`/dialogue/${d.id}`}
                className="block bg-zinc-900 border border-zinc-800 rounded-lg p-3 hover:border-zinc-600 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium">
                    &ldquo;{d.proposition}&rdquo;
                  </p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded whitespace-nowrap shrink-0 ${
                      STATUS_COLORS[d.status] || ""
                    }`}
                  >
                    {d.status.replace("_", " ")}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  {d.role} &middot;{" "}
                  {new Date(d.createdAt).toLocaleDateString()}
                </p>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Trophy shelf placeholder */}
      <div className="border border-dashed border-zinc-800 rounded-lg p-6 text-center">
        <p className="text-zinc-600 text-sm">Trophy shelf coming soon</p>
      </div>
    </div>
  );
}
