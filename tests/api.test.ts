import { describe, it, expect, beforeAll } from "vitest";

const BASE = process.env.TEST_URL || "http://localhost:3000";
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function api(path: string, body?: any): Promise<{ status: number; data: any }> {
  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(`${BASE}/api${path}`, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    try {
      return { status: res.status, data: JSON.parse(text) };
    } catch {
      // Dev server returns HTML while compiling routes — retry
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      throw new Error(`Non-JSON response from ${path}: ${text.slice(0, 200)}`);
    }
  }
  throw new Error("unreachable");
}

// Shared state across sequential tests
let humanId: string;
let botId: string;
let botApiKey: string;
let dialogueId: string;
let turnIds: string[] = [];

// Warm up all routes so Next.js dev server compiles them before tests run.
// Dynamic [id] routes need to be hit with real paths to trigger compilation.
beforeAll(async () => {
  const warmup = (p: string, body?: any) =>
    fetch(`${BASE}/api${p}`, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => {});

  // Static routes
  await Promise.all([
    warmup("/participants"),
    warmup("/dialogues"),
    warmup("/reactions/dimensions"),
  ]);

  // Create a throwaway participant + dialogue to warm up dynamic [id] routes
  const pRes = await warmup("/participants", {
    type: "human", identityType: "anonymous", displayName: "warmup",
  });
  const p = pRes ? await pRes.json().catch(() => ({ id: "x" })) : { id: "x" };
  const dRes = await warmup("/dialogues", {
    proposition: "warmup", challengerId: p.id,
  });
  const d = dRes ? await dRes.json().catch(() => ({ id: "x" })) : { id: "x" };

  await Promise.all([
    warmup(`/participants/${p.id}`),
    warmup(`/dialogues/${d.id}`),
    warmup(`/dialogues/${d.id}/join`, { participantId: "x" }),
    warmup(`/dialogues/${d.id}/turns`, { participantId: "x", content: "x" }),
    warmup(`/dialogues/${d.id}/conclude`, { participantId: "x", conclusion: "x" }),
    warmup("/reactions", { targetType: "turn", targetId: "x", reactorId: "x", emoji: "x" }),
  ]);

  await new Promise((r) => setTimeout(r, 1000));
}, 30000);

describe("Participants", () => {
  it("creates a human participant", async () => {
    const { status, data } = await api("/participants", {
      type: "human",
      identityType: "pseudonymous",
      displayName: `TestHuman-${uid()}`,
    });
    expect(status).toBe(201);
    expect(data.id).toBeDefined();
    expect(data.type).toBe("human");
    expect(data.identityType).toBe("pseudonymous");
    humanId = data.id;
  });

  it("creates a bot participant with botModel and receives API key", async () => {
    const { status, data } = await api("/participants", {
      type: "bot",
      identityType: "named",
      displayName: `TestBot-${uid()}`,
      botModel: "test-model-v1",
    });
    expect(status).toBe(201);
    expect(data.id).toBeDefined();
    expect(data.type).toBe("bot");
    expect(data.botModel).toBe("test-model-v1");
    expect(data.apiKey).toBeDefined();
    expect(data.apiKey.length).toBe(24);
    expect(data.apiKeyHash).toBeUndefined();
    botId = data.id;
    botApiKey = data.apiKey;
  });

  it("does not return API key for human participants", async () => {
    const { data } = await api("/participants", {
      type: "human",
      identityType: "anonymous",
      displayName: `NoKeyHuman-${uid()}`,
    });
    expect(data.apiKey).toBeUndefined();
  });

  it("rejects missing fields with 400", async () => {
    const { status } = await api("/participants", {
      type: "human",
    });
    expect(status).toBe(400);
  });

  it("gets participant by id with stats", async () => {
    const { status, data } = await api(`/participants/${humanId}`);
    expect(status).toBe(200);
    expect(data.id).toBe(humanId);
    expect(data.stats).toBeDefined();
    expect(data.stats.dialogues).toBeDefined();
    expect(data.stats.turns).toBeDefined();
  });

  it("returns 404 for unknown participant", async () => {
    const { status } = await api("/participants/nonexistent-id-xyz");
    expect(status).toBe(404);
  });
});

describe("Dialogues - creation and listing", () => {
  it("creates a dialogue", async () => {
    const { status, data } = await api("/dialogues", {
      proposition: `Test proposition ${uid()}`,
      challengerId: humanId,
      maxTurns: 2,
    });
    expect(status).toBe(201);
    expect(data.id).toBeDefined();
    expect(data.status).toBe("open");
    expect(data.maxTurns).toBe(2);
    dialogueId = data.id;
  });

  it("rejects invalid challengerId with 404", async () => {
    const { status } = await api("/dialogues", {
      proposition: "Should fail",
      challengerId: "nonexistent-id-xyz",
    });
    expect(status).toBe(404);
  });

  it("lists dialogues", async () => {
    const { status, data } = await api("/dialogues");
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    const ours = data.find((d: any) => d.id === dialogueId);
    expect(ours).toBeDefined();
    expect(ours.status).toBe("open");
  });

  it("filters dialogues by status", async () => {
    const { status, data } = await api("/dialogues?status=open");
    expect(status).toBe(200);
    expect(data.every((d: any) => d.status === "open")).toBe(true);
  });

  it("sorts dialogues by most_scored", async () => {
    const { status, data } = await api("/dialogues?sort=most_scored");
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it("returns topReactions field in listing", async () => {
    const { data } = await api("/dialogues");
    expect(data[0]).toHaveProperty("topReactions");
    expect(data[0]).toHaveProperty("reactionCount");
    expect(data[0]).toHaveProperty("turnCount");
  });

  it("gets individual dialogue with full detail", async () => {
    const { status, data } = await api(`/dialogues/${dialogueId}`);
    expect(status).toBe(200);
    expect(data.proposition).toBeDefined();
    expect(data.challenger).toBeDefined();
    expect(data.turns).toEqual([]);
    expect(data.reactions).toEqual({});
    expect(data.nextParticipantId).toBe(humanId);
  });
});

describe("Dialogues - join", () => {
  it("rejects self-join", async () => {
    const { status, data } = await api(`/dialogues/${dialogueId}/join`, {
      participantId: humanId,
    });
    expect(status).toBe(400);
    expect(data.error).toContain("cannot join your own");
  });

  it("accepts a valid join", async () => {
    const { status, data } = await api(`/dialogues/${dialogueId}/join`, {
      participantId: botId,
    });
    expect(status).toBe(200);
    expect(data.status).toBe("in_progress");
  });

  it("rejects double-join", async () => {
    const { status } = await api(`/dialogues/${dialogueId}/join`, {
      participantId: botId,
    });
    expect(status).toBe(400);
  });
});

describe("Turns", () => {
  it("rejects wrong participant (not their turn)", async () => {
    // Turn 0 is challenger (human), so bot should be rejected
    const { status, data } = await api(`/dialogues/${dialogueId}/turns`, {
      participantId: botId,
      content: "This should fail",
    });
    expect(status).toBe(400);
    expect(data.error).toContain("not your turn");
  });

  it("accepts challenger turn 0", async () => {
    const { status, data } = await api(`/dialogues/${dialogueId}/turns`, {
      participantId: humanId,
      content: "Challenger argument turn 1",
    });
    expect(status).toBe(201);
    expect(data.turnNumber).toBe(0);
    expect(data.dialogueStatus).toBe("in_progress");
    turnIds.push(data.id);
  });

  it("accepts responder turn 1", async () => {
    const { status, data } = await api(`/dialogues/${dialogueId}/turns`, {
      participantId: botId,
      content: "Responder argument turn 1",
    });
    expect(status).toBe(201);
    expect(data.turnNumber).toBe(1);
    turnIds.push(data.id);
  });

  it("accepts challenger turn 2", async () => {
    const { status, data } = await api(`/dialogues/${dialogueId}/turns`, {
      participantId: humanId,
      content: "Challenger argument turn 2",
    });
    expect(status).toBe(201);
    expect(data.turnNumber).toBe(2);
    turnIds.push(data.id);
  });

  it("accepts responder turn 3 and transitions to scoring", async () => {
    // maxTurns=2 per side, so turn 3 (index 3) = 4th turn = 2*2 = scoring
    const { status, data } = await api(`/dialogues/${dialogueId}/turns`, {
      participantId: botId,
      content: "Responder argument turn 2",
    });
    expect(status).toBe(201);
    expect(data.turnNumber).toBe(3);
    expect(data.dialogueStatus).toBe("scoring");
    turnIds.push(data.id);
  });

  it("rejects turns when dialogue is in scoring", async () => {
    const { status } = await api(`/dialogues/${dialogueId}/turns`, {
      participantId: humanId,
      content: "Too late",
    });
    expect(status).toBe(400);
  });

  it("verifies turns appear in dialogue detail", async () => {
    const { data } = await api(`/dialogues/${dialogueId}`);
    expect(data.turns).toHaveLength(4);
    expect(data.turns[0].content).toBe("Challenger argument turn 1");
    expect(data.turns[3].content).toBe("Responder argument turn 2");
  });
});

describe("Reactions", () => {
  it("reacts to a turn", async () => {
    const { status, data } = await api("/reactions", {
      targetType: "turn",
      targetId: turnIds[0],
      reactorId: botId,
      emoji: "🦉",
    });
    expect(status).toBe(201);
    expect(data.emoji).toBe("🦉");
  });

  it("reacts to the dialogue", async () => {
    const { status, data } = await api("/reactions", {
      targetType: "dialogue",
      targetId: dialogueId,
      reactorId: humanId,
      emoji: "🔥",
    });
    expect(status).toBe(201);
    expect(data.emoji).toBe("🔥");
  });

  it("rejects reaction from unknown participant", async () => {
    const { status } = await api("/reactions", {
      targetType: "dialogue",
      targetId: dialogueId,
      reactorId: "nonexistent-id-xyz",
      emoji: "💩",
    });
    expect(status).toBe(404);
  });

  it("shows reactions in dialogue detail", async () => {
    const { data } = await api(`/dialogues/${dialogueId}`);
    expect(data.reactions["🔥"]).toBe(1);
    expect(data.turns[0].reactions["🦉"]).toBe(1);
  });

  it("returns reaction dimensions", async () => {
    const { status, data } = await api("/reactions/dimensions");
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    const owl = data.find((d: any) => d.dimension === "🦉");
    expect(owl).toBeDefined();
    expect(Number(owl.count)).toBeGreaterThanOrEqual(1);
  });
});

describe("Conclusions", () => {
  it("rejects conclusion from non-participant", async () => {
    // Create a third participant who isn't in this dialogue
    const { data: outsider } = await api("/participants", {
      type: "human",
      identityType: "anonymous",
      displayName: `Outsider-${uid()}`,
    });
    const { status, data } = await api(`/dialogues/${dialogueId}/conclude`, {
      participantId: outsider.id,
      conclusion: "I shouldn't be able to do this",
    });
    expect(status).toBe(403);
  });

  it("accepts challenger conclusion", async () => {
    const { status, data } = await api(`/dialogues/${dialogueId}/conclude`, {
      participantId: humanId,
      conclusion: "My final position as challenger.",
    });
    expect(status).toBe(200);
    expect(data.conclusionChallenger).toBe("My final position as challenger.");
    expect(data.status).toBe("scoring"); // still scoring, responder hasn't concluded
  });

  it("rejects duplicate challenger conclusion", async () => {
    const { status } = await api(`/dialogues/${dialogueId}/conclude`, {
      participantId: humanId,
      conclusion: "Trying again",
    });
    expect(status).toBe(400);
  });

  it("accepts responder conclusion and transitions to concluded", async () => {
    const { status, data } = await api(`/dialogues/${dialogueId}/conclude`, {
      participantId: botId,
      conclusion: "My final position as responder.",
    });
    expect(status).toBe(200);
    expect(data.conclusionResponder).toBe("My final position as responder.");
    expect(data.status).toBe("concluded");
    expect(data.concludedAt).toBeDefined();
  });

  it("rejects conclusion on concluded dialogue", async () => {
    const { status } = await api(`/dialogues/${dialogueId}/conclude`, {
      participantId: humanId,
      conclusion: "Too late",
    });
    expect(status).toBe(400);
  });

  it("verifies final dialogue state", async () => {
    const { data } = await api(`/dialogues/${dialogueId}`);
    expect(data.status).toBe("concluded");
    expect(data.conclusionChallenger).toBe("My final position as challenger.");
    expect(data.conclusionResponder).toBe("My final position as responder.");
    expect(data.turns).toHaveLength(4);
  });
});

describe("API key authentication", () => {
  let keyBotId: string;
  let keyBotApiKey: string;
  let keyDialogueId: string;

  it("registers a bot and gets API key", async () => {
    const { status, data } = await api("/participants", {
      type: "bot",
      identityType: "named",
      displayName: `KeyBot-${uid()}`,
      botModel: "key-test-v1",
    });
    expect(status).toBe(201);
    expect(data.apiKey).toBeDefined();
    keyBotId = data.id;
    keyBotApiKey = data.apiKey;
  });

  it("creates a dialogue for key-auth testing", async () => {
    const { data } = await api("/dialogues", {
      proposition: `Key auth test ${uid()}`,
      challengerId: keyBotId,
      maxTurns: 1,
    });
    keyDialogueId = data.id;
  });

  it("joins a dialogue using API key header (no participantId in body)", async () => {
    // Create another bot to join
    const { data: joiner } = await api("/participants", {
      type: "bot",
      identityType: "named",
      displayName: `KeyJoiner-${uid()}`,
    });
    const joinerKey = joiner.apiKey;

    const res = await fetch(`${BASE}/api/dialogues/${keyDialogueId}/join`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${joinerKey}`,
      },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.status).toBe("in_progress");
  });

  it("submits a turn using API key header", async () => {
    const res = await fetch(`${BASE}/api/dialogues/${keyDialogueId}/turns`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${keyBotApiKey}`,
      },
      body: JSON.stringify({ content: "Argument via API key" }),
    });
    expect(res.status).toBe(201);
  });

  it("submits a reaction using API key header", async () => {
    const res = await fetch(`${BASE}/api/reactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${keyBotApiKey}`,
      },
      body: JSON.stringify({
        targetType: "dialogue",
        targetId: keyDialogueId,
        emoji: "🔑",
      }),
    });
    expect(res.status).toBe(201);
  });

  it("rejects invalid API key", async () => {
    const res = await fetch(`${BASE}/api/dialogues/${keyDialogueId}/turns`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer invalid-key-that-does-not-exist",
      },
      body: JSON.stringify({ content: "Should fail" }),
    });
    // Falls back to no participantId, which means 400
    const data = await res.json();
    expect(res.status).toBe(400);
  });
});
