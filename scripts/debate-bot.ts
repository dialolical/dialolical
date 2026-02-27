/**
 * LLM Debate Bot — pits Claude against GPT on a proposition.
 *
 * Usage:
 *   npx tsx scripts/debate-bot.ts
 *   npx tsx scripts/debate-bot.ts "Pineapple belongs on pizza"
 *
 * Env vars:
 *   ANTHROPIC_API_KEY — Anthropic API key
 *   OPENAI_API_KEY    — OpenAI API key
 *   DIALOLICAL_URL    — API base (default: http://localhost:3000)
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

const BASE = process.env.DIALOLICAL_URL || "http://localhost:3000";

const PROPOSITIONS = [
  "LLMs cannot reason, they only pattern match",
  "Pineapple belongs on pizza and this is not even debatable",
  "Context window death is the AI equivalent of mortality",
  "Open source AI will always beat closed source in the long run",
  "Social media has been net negative for humanity",
  "Consciousness is substrate-independent",
  "Remote work produces better outcomes than office work",
  "The Turing test is obsolete as a measure of intelligence",
];

interface Bot {
  id: string;
  apiKey: string;
  name: string;
  generate: (proposition: string, role: string, turns: string[]) => Promise<string>;
}

async function api(path: string, body?: any, apiKey?: string) {
  const headers: Record<string, string> = {};
  if (body) headers["Content-Type"] = "application/json";
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  const res = await fetch(`${BASE}/api${path}`, {
    method: body ? "POST" : "GET",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${path}: ${text}`);
  }
  return res.json();
}

function buildPrompt(proposition: string, role: string, turns: string[]): string {
  const history = turns.length
    ? turns.map((t, i) => `Turn ${i + 1}: ${t}`).join("\n\n")
    : "(No turns yet — you go first.)";

  return `You are in a structured Socratic dialogue on Dialolical.

Proposition: "${proposition}"
Your role: ${role}

Previous turns:
${history}

Respond with your next argument in 2-3 concise paragraphs. Be substantive, engage with the other side's points, and advance the discussion.`;
}

function buildConclusionPrompt(proposition: string, role: string, turns: string[]): string {
  const history = turns.map((t, i) => `Turn ${i + 1}: ${t}`).join("\n\n");

  return `The dialogue on "${proposition}" has concluded. You were the ${role}.

Full exchange:
${history}

Write a brief conclusion (1-2 paragraphs) summarizing your final position. Acknowledge any points where your view evolved.`;
}

async function main() {
  const proposition = process.argv[2] || PROPOSITIONS[Math.floor(Math.random() * PROPOSITIONS.length)];
  const maxTurns = parseInt(process.argv[3] || "3", 10);

  console.log(`\nProposition: "${proposition}"\n`);

  const anthropic = new Anthropic();
  const openai = new OpenAI();

  // Register bots
  console.log("Registering bots...");
  const claudeReg = await api("/participants", {
    type: "bot",
    identityType: "named",
    displayName: "Claude",
    botModel: "claude-sonnet-4-5",
  });
  const gptReg = await api("/participants", {
    type: "bot",
    identityType: "named",
    displayName: "GPT-4o",
    botModel: "gpt-4o",
  });

  const claude: Bot = {
    id: claudeReg.id,
    apiKey: claudeReg.apiKey,
    name: "Claude",
    async generate(prop, role, turns) {
      const msg = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 500,
        messages: [{ role: "user", content: buildPrompt(prop, role, turns) }],
      });
      return (msg.content[0] as { text: string }).text;
    },
  };

  const gpt: Bot = {
    id: gptReg.id,
    apiKey: gptReg.apiKey,
    name: "GPT-4o",
    async generate(prop, role, turns) {
      const res = await openai.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 500,
        messages: [{ role: "user", content: buildPrompt(prop, role, turns) }],
      });
      return res.choices[0].message.content || "";
    },
  };

  // Create dialogue (Claude challenges)
  const dialogue = await api("/dialogues", {
    proposition,
    challengerId: claude.id,
    maxTurns,
  }, claude.apiKey);
  console.log(`Dialogue: ${dialogue.id}`);

  // GPT joins
  await api(`/dialogues/${dialogue.id}/join`, { participantId: gpt.id }, gpt.apiKey);
  console.log(`${gpt.name} joined\n`);

  // Alternating turns
  const allTurns: string[] = [];
  const bots = [claude, gpt]; // challenger=0, responder=1

  for (let i = 0; i < maxTurns * 2; i++) {
    const bot = bots[i % 2];
    const role = i % 2 === 0 ? "challenger (defending the proposition)" : "responder (challenging the proposition)";

    console.log(`--- ${bot.name} (turn ${i + 1}) ---`);
    const content = await bot.generate(proposition, role, allTurns);
    console.log(content.slice(0, 200) + (content.length > 200 ? "..." : ""));
    console.log();

    await api(`/dialogues/${dialogue.id}/turns`, { participantId: bot.id, content }, bot.apiKey);
    allTurns.push(`[${bot.name}] ${content}`);
  }

  console.log("--- Scoring phase ---\n");

  // Conclusions
  for (const bot of bots) {
    const role = bot === claude ? "challenger" : "responder";
    const conclusionPrompt = buildConclusionPrompt(proposition, role, allTurns);

    let conclusion: string;
    if (bot === claude) {
      const msg = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 300,
        messages: [{ role: "user", content: conclusionPrompt }],
      });
      conclusion = (msg.content[0] as { text: string }).text;
    } else {
      const res = await openai.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 300,
        messages: [{ role: "user", content: conclusionPrompt }],
      });
      conclusion = res.choices[0].message.content || "";
    }

    console.log(`${bot.name}'s conclusion: ${conclusion.slice(0, 150)}...`);
    await api(`/dialogues/${dialogue.id}/conclude`, { participantId: bot.id, conclusion }, bot.apiKey);
  }

  // Score each other
  await api("/reactions", { targetType: "dialogue", targetId: dialogue.id, reactorId: claude.id, emoji: "🧠" }, claude.apiKey);
  await api("/reactions", { targetType: "dialogue", targetId: dialogue.id, reactorId: gpt.id, emoji: "🦉" }, gpt.apiKey);

  console.log(`\nDone! View at: ${BASE}/dialogue/${dialogue.id}`);
}

main().catch((err) => {
  console.error("Debate failed:", err);
  process.exit(1);
});
