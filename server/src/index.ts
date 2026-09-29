import express from "express";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

// The database is a single file (todos.db) created next to the server folder.
// On a hosting service, set DB_PATH to a location on a persistent disk (see DEPLOY.md).
const db = new Database(process.env.DB_PATH ?? "todos.db");
db.exec(`
  CREATE TABLE IF NOT EXISTS todos (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    title    TEXT    NOT NULL,
    content  TEXT    NOT NULL DEFAULT '',
    done     INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL,
    due_date TEXT
  )
`);

// Upgrade an older database (from the first version) without losing your items.
const columns = (db.prepare("PRAGMA table_info(todos)").all() as { name: string }[]).map((c) => c.name);
if (columns.includes("text")) db.exec("ALTER TABLE todos RENAME COLUMN text TO title");
if (!columns.includes("content")) db.exec("ALTER TABLE todos ADD COLUMN content TEXT NOT NULL DEFAULT ''");

if (!columns.includes("due_date")) db.exec("ALTER TABLE todos ADD COLUMN due_date TEXT");

type Row = { id: number; title: string; content: string; done: number; position: number; due_date: string | null };

// A due date must look like 2026-10-31, otherwise we store nothing.
const cleanDate = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

// Every change returns the full, ordered list so the page always stays in sync.
const list = () =>
  (db.prepare("SELECT * FROM todos ORDER BY position").all() as Row[]).map((r) => ({
    id: r.id,
    title: r.title,
    content: r.content,
    done: r.done === 1,
    dueDate: r.due_date,
  }));

const app = express();
app.use(express.json());

// Get all todos
app.get("/api/todos", (_req, res) => res.json(list()));

// Add a todo (goes to the bottom)
app.post("/api/todos", (req, res) => {
  const title = String(req.body?.title ?? "").trim();
  const content = String(req.body?.content ?? "").trim();
  if (!title) return res.status(400).json({ error: "Title is required" });
  const { m } = db.prepare("SELECT COALESCE(MAX(position), 0) AS m FROM todos").get() as { m: number };
  db.prepare("INSERT INTO todos (title, content, position, due_date) VALUES (?, ?, ?, ?)").run(
    title, content, m + 1, cleanDate(req.body?.dueDate));
  res.status(201).json(list());
});

// Save a new order: body is { ids: [3, 1, 2] } in the order you want
app.put("/api/todos/order", (req, res) => {
  const ids = req.body?.ids;
  if (!Array.isArray(ids)) return res.status(400).json({ error: "ids must be a list" });
  const update = db.prepare("UPDATE todos SET position = ? WHERE id = ?");
  db.transaction(() => ids.forEach((id: number, i: number) => update.run(i + 1, id)))();
  res.json(list());
});

// Delete every checked-off todo (must come before the /:id route below)
app.delete("/api/todos/completed", (_req, res) => {
  db.prepare("DELETE FROM todos WHERE done = 1").run();
  res.json(list());
});

// Edit a todo. Send only what changed: title, content, dueDate and/or done.
app.patch("/api/todos/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM todos WHERE id = ?").get(req.params.id) as Row | undefined;
  if (!row) return res.status(404).json({ error: "Not found" });
  const b = req.body ?? {};
  const title = b.title !== undefined ? String(b.title).trim() : row.title;
  const content = b.content !== undefined ? String(b.content).trim() : row.content;
  const done = b.done !== undefined ? (b.done ? 1 : 0) : row.done;
  const dueDate = b.dueDate !== undefined ? cleanDate(b.dueDate) : row.due_date;
  if (!title) return res.status(400).json({ error: "Title is required" });
  db.prepare("UPDATE todos SET title = ?, content = ?, done = ?, due_date = ? WHERE id = ?").run(
    title, content, done, dueDate, row.id);
  res.json(list());
});

// Delete a todo
app.delete("/api/todos/:id", (req, res) => {
  db.prepare("DELETE FROM todos WHERE id = ?").run(req.params.id);
  res.json(list());
});

// When the React app has been built (npm run build), the server also serves the website itself.
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../client/dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
