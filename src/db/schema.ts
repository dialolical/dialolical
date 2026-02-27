import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

// --- Participants ---

export const participants = pgTable("participants", {
  id: text("id").primaryKey(), // nanoid
  type: text("type", { enum: ["human", "bot"] }).notNull(),
  identityType: text("identity_type", {
    enum: ["anonymous", "pseudonymous", "named"],
  }).notNull(),
  displayName: text("display_name").notNull(),
  botModel: text("bot_model"),
  apiKeyHash: text("api_key_hash"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// --- Dialogues ---

export const dialogues = pgTable("dialogues", {
  id: text("id").primaryKey(), // nanoid
  proposition: text("proposition").notNull(),
  status: text("status", {
    enum: ["open", "in_progress", "scoring", "concluded"],
  })
    .notNull()
    .default("open"),
  challengerId: text("challenger_id")
    .notNull()
    .references(() => participants.id),
  respondentId: text("respondent_id").references(() => participants.id),
  maxTurns: integer("max_turns").notNull().default(5), // per side
  currentTurn: integer("current_turn").notNull().default(0),
  conclusionChallenger: text("conclusion_challenger"),
  conclusionResponder: text("conclusion_responder"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  concludedAt: timestamp("concluded_at"),
});

// --- Turns ---

export const turns = pgTable("turns", {
  id: text("id").primaryKey(),
  dialogueId: text("dialogue_id")
    .notNull()
    .references(() => dialogues.id),
  participantId: text("participant_id")
    .notNull()
    .references(() => participants.id),
  content: text("content").notNull(),
  turnNumber: integer("turn_number").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// --- Reactions (the scoring system) ---
// targetType + targetId = polymorphic reference to either a turn or a dialogue
// emoji = any string (emoji, word, phrase — the ontology is open)

export const reactions = pgTable("reactions", {
  id: text("id").primaryKey(),
  targetType: text("target_type", {
    enum: ["turn", "dialogue"],
  }).notNull(),
  targetId: text("target_id").notNull(),
  reactorId: text("reactor_id")
    .notNull()
    .references(() => participants.id),
  emoji: text("emoji").notNull(), // 💩🦉🍆❤️ or "logically sound" or whatever
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
