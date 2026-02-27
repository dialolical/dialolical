"use client";

type EmojiEntry = { emoji: string; count: number };

interface TrophyCardProps {
  type: "winner" | "participant";
  emojis: EmojiEntry[];
  title: string;
  date: string;
  dialogueId?: string;
}

function buildEmojiGrid(emojis: EmojiEntry[]): string[] {
  const expanded: string[] = [];
  for (const { emoji, count } of emojis) {
    for (let i = 0; i < Math.min(count, 6); i++) {
      expanded.push(emoji);
    }
  }
  return expanded.slice(0, 9);
}

export default function TrophyCard({ type, emojis, title, date, dialogueId }: TrophyCardProps) {
  const grid = buildEmojiGrid(emojis);
  const totalReactions = emojis.reduce((sum, e) => sum + e.count, 0);
  const isWinner = type === "winner";
  const borderColor = isWinner ? "border-yellow-600" : "border-zinc-600";
  const bgColor = isWinner ? "bg-yellow-950/30" : "bg-zinc-900";
  const badge = isWinner ? "Winner" : "Participant";
  const badgeColor = isWinner ? "bg-yellow-900 text-yellow-300" : "bg-zinc-800 text-zinc-400";

  const cols = grid.length <= 4 ? 2 : 3;

  const content = (
    <div className={`border ${borderColor} ${bgColor} rounded-lg p-3 w-full max-w-[160px] hover:border-zinc-500 transition`}>
      {/* Badge */}
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${badgeColor}`}>{badge}</span>
        {isWinner && <span className="text-xs">&#x1F451;</span>}
      </div>

      {/* Emoji grid */}
      <div
        className="grid gap-1 justify-center mb-2"
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
        }}
      >
        {grid.length > 0 ? (
          grid.map((emoji, i) => (
            <span key={i} className="text-lg text-center leading-none">
              {emoji}
            </span>
          ))
        ) : (
          <span className="text-zinc-600 text-xs col-span-3 text-center">no scores</span>
        )}
      </div>

      {/* Title */}
      <p className="text-[10px] text-zinc-400 leading-tight line-clamp-2 mb-1">
        &ldquo;{title}&rdquo;
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between text-[9px] text-zinc-600">
        <span>{new Date(date).toLocaleDateString()}</span>
        <span>{totalReactions} scores</span>
      </div>
    </div>
  );

  if (dialogueId) {
    return <a href={`/dialogue/${dialogueId}`}>{content}</a>;
  }
  return content;
}
