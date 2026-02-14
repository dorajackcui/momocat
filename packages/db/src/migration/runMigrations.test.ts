import { afterEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { DEFAULT_PROJECT_AI_MODEL, PROJECT_AI_MODELS } from "@cat/core";
import { runMigrations } from "./runMigrations";

function createSchemaVersionTable(db: Database.Database, version: number) {
  db.exec(`
    CREATE TABLE schema_version (
      version INTEGER PRIMARY KEY
    );
  `);
  db.prepare("INSERT INTO schema_version(version) VALUES (?)").run(version);
}

describe("runMigrations v12 aiModel normalization", () => {
  const openedDbs: Database.Database[] = [];

  afterEach(() => {
    for (const db of openedDbs.splice(0)) {
      db.close();
    }
  });

  it("normalizes invalid aiModel values and keeps supported values", () => {
    const db = new Database(":memory:");
    openedDbs.push(db);
    createSchemaVersionTable(db, 11);

    db.exec(`
      CREATE TABLE projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        srcLang TEXT NOT NULL,
        tgtLang TEXT NOT NULL,
        aiModel TEXT
      );
    `);

    db.prepare(
      "INSERT INTO projects(name, srcLang, tgtLang, aiModel) VALUES (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)",
    ).run(
      "Invalid Model",
      "en",
      "zh",
      "gpt-unknown",
      "Valid Model",
      "en",
      "zh",
      PROJECT_AI_MODELS[0],
      "Empty Model",
      "en",
      "zh",
      "",
    );

    runMigrations(db);

    const rows = db
      .prepare("SELECT name, aiModel FROM projects ORDER BY id")
      .all() as Array<{ name: string; aiModel: string }>;

    expect(rows[0].aiModel).toBe(DEFAULT_PROJECT_AI_MODEL);
    expect(rows[1].aiModel).toBe(PROJECT_AI_MODELS[0]);
    expect(rows[2].aiModel).toBe(DEFAULT_PROJECT_AI_MODEL);
  });

  it("adds missing aiModel column and backfills default model", () => {
    const db = new Database(":memory:");
    openedDbs.push(db);
    createSchemaVersionTable(db, 11);

    db.exec(`
      CREATE TABLE projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        srcLang TEXT NOT NULL,
        tgtLang TEXT NOT NULL
      );
    `);

    db.prepare(
      "INSERT INTO projects(name, srcLang, tgtLang) VALUES (?, ?, ?)",
    ).run("No Model Column", "en", "zh");

    runMigrations(db);

    const row = db
      .prepare("SELECT aiModel FROM projects WHERE id = 1")
      .get() as { aiModel: string };
    expect(row.aiModel).toBe(DEFAULT_PROJECT_AI_MODEL);
  });
});

describe("runMigrations v14 segment qa issue cache", () => {
  const openedDbs: Database.Database[] = [];

  afterEach(() => {
    for (const db of openedDbs.splice(0)) {
      db.close();
    }
  });

  it("adds qaIssuesJson column for existing segments table", () => {
    const db = new Database(":memory:");
    openedDbs.push(db);
    createSchemaVersionTable(db, 13);

    db.exec(`
      CREATE TABLE segments (
        segmentId TEXT PRIMARY KEY,
        fileId INTEGER NOT NULL,
        orderIndex INTEGER NOT NULL,
        sourceTokensJson TEXT NOT NULL,
        targetTokensJson TEXT NOT NULL,
        status TEXT NOT NULL,
        tagsSignature TEXT NOT NULL,
        matchKey TEXT NOT NULL,
        srcHash TEXT NOT NULL,
        metaJson TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
    `);

    runMigrations(db);

    const columns = db.prepare("PRAGMA table_info(segments)").all() as Array<{
      name: string;
    }>;
    expect(columns.some((column) => column.name === "qaIssuesJson")).toBe(true);
  });
});
