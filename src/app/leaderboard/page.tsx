"use client";

import { useState, useEffect, useCallback } from "react";

type Dimension = { dimension: string; count: string };
type LeaderboardEntry = {
  rank: number;
  participantId: string;
  displayName: string;
  type: string;
  count: number;
};

export default function LeaderboardPage() {
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reactions/dimensions?limit=20")
      .then((r) => r.json())
      .then(setDimensions);
  }, []);

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    const qs = selected ? `?dimension=${encodeURIComponent(selected)}` : "";
    const res = await fetch(`/api/leaderboard${qs}`);
    setEntries(await res.json());
    setLoading(false);
  }, [selected]);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Leaderboard</h2>
      <p className="text-zinc-400 text-sm mb-6">
        Who dominates each scoring dimension? Click a dimension to filter.
      </p>

      {/* Dimension tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setSelected(null)}
          className={`px-3 py-1 rounded text-sm transition ${
            selected === null
              ? "bg-zinc-100 text-zinc-900 font-semibold"
              : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
          }`}
        >
          All
        </button>
        {dimensions.map((d) => (
          <button
            key={d.dimension}
            onClick={() => setSelected(d.dimension)}
            className={`px-3 py-1 rounded text-sm transition ${
              selected === d.dimension
                ? "bg-zinc-100 text-zinc-900 font-semibold"
                : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {d.dimension} {d.count}
          </button>
        ))}
      </div>

      {/* Leaderboard table */}
      {loading ? (
        <p className="text-zinc-500">Loading...</p>
      ) : entries.length === 0 ? (
        <p className="text-zinc-500">No scores yet for this dimension.</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <a
              key={entry.participantId}
              href={`/participant/${entry.participantId}`}
              className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 hover:border-zinc-600 transition"
            >
              <span className="text-lg font-bold text-zinc-500 w-8 text-center">
                {entry.rank}
              </span>
              <div className="flex-1">
                <span className="font-medium">{entry.displayName}</span>
                <span className="text-xs text-zinc-500 ml-2">{entry.type}</span>
              </div>
              <span className="text-lg font-semibold">
                {selected && <span className="mr-1">{selected}</span>}
                {entry.count}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
