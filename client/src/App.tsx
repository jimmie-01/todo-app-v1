import { useEffect, useState } from "react";

type Todo = { id: number; title: string; content: string; done: boolean; dueDate: string | null };

const today = () => new Date().toLocaleDateString("en-CA"); // e.g. 2026-10-31
const niceDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

async function api(path: string, method = "GET", body?: unknown): Promise<Todo[]> {
  const res = await fetch(`/api/todos${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Request failed");
  return res.json();
}

export default function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [dragId, setDragId] = useState<number | null>(null);
  const [overId, setOverId] = useState<number | null>(null);

  // Which item is being edited, and the text typed so far.
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [draftDue, setDraftDue] = useState("");

  // Run an action, show the server's updated list, and report problems.
  async function run(action: () => Promise<Todo[]>) {
    try {
      setTodos(await action());
      setError("");
    } catch {
      setError("Could not reach the server. Is it running?");
    }
  }

  useEffect(() => { run(() => api("")); }, []);

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    run(() => api("", "POST", { title, content, dueDate }));
    setTitle("");
    setContent("");
    setDueDate("");
  }

  function startEdit(t: Todo) {
    setEditingId(t.id);
    setDraftTitle(t.title);
    setDraftContent(t.content);
    setDraftDue(t.dueDate ?? "");
  }

  function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId === null || !draftTitle.trim()) return;
    run(() => api(`/${editingId}`, "PATCH", { title: draftTitle, content: draftContent, dueDate: draftDue }));
    setEditingId(null);
  }

  function move(fromId: number, toId: number) {
    if (fromId === toId) return;
    const next = [...todos];
    const from = next.findIndex((t) => t.id === fromId);
    const to = next.findIndex((t) => t.id === toId);
    next.splice(to, 0, next.splice(from, 1)[0]);
    setTodos(next); // update the screen right away
    run(() => api("/order", "PUT", { ids: next.map((t) => t.id) }));
  }

  const left = todos.filter((t) => !t.done).length;
  const doneCount = todos.length - left;
  const q = search.trim().toLowerCase();
  const shown = q ? todos.filter((t) => (t.title + " " + t.content).toLowerCase().includes(q)) : todos;

  function clearCompleted() {
    if (window.confirm(`Delete ${doneCount} completed item${doneCount === 1 ? "" : "s"}? This cannot be undone.`)) {
      run(() => api("/completed", "DELETE"));
    }
  }

  return (
    <main>
      <h1>To do</h1>
      <p className="count">{todos.length === 0 ? "Nothing yet." : left === 0 ? "All done. Nice work." : `${left} of ${todos.length} left`}</p>
      {todos.length > 0 && (
        <div className="progress" role="progressbar" aria-label="Completed items" aria-valuemin={0} aria-valuemax={todos.length} aria-valuenow={todos.length - left}>
          <div style={{ width: `${((todos.length - left) / todos.length) * 100}%` }} />
        </div>
      )}

      <form className="add" onSubmit={add}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" aria-label="Title" />
        <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Details (optional)" aria-label="Content" rows={2} />
        <label className="due">Due date (optional)
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>
        <button type="submit">Add item</button>
      </form>

      {todos.length > 0 && (
        <div className="tools">
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search titles and details" aria-label="Search" />
          {doneCount > 0 && <button className="link delete" onClick={clearCompleted}>Clear {doneCount} completed</button>}
        </div>
      )}
      {q && <p className="empty">Reordering is off while a search is active.</p>}
      {q && shown.length === 0 && <p className="empty">No items match "{search}".</p>}

      {error && <p className="error" role="alert">{error}</p>}
      {todos.length === 0 && !error && <p className="empty">Write a title above and press Add item.</p>}

      <ul>
        {shown.map((t) => (
          <li
            key={t.id}
            draggable={editingId !== t.id && !q}
            className={(dragId === t.id ? "dragging " : "") + (overId === t.id && dragId !== t.id ? "over" : "")}
            onDragStart={() => setDragId(t.id)}
            onDragEnd={() => { setDragId(null); setOverId(null); }}
            onDragEnter={() => setOverId(t.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (dragId !== null) move(dragId, t.id); setOverId(null); }}
          >
            <span className="handle" aria-hidden="true" title="Drag to reorder">⋮⋮</span>

            {editingId === t.id ? (
              <form className="edit" onSubmit={saveEdit}>
                <input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} aria-label="Edit title" autoFocus />
                <textarea value={draftContent} onChange={(e) => setDraftContent(e.target.value)} aria-label="Edit content" rows={3} />
                <label className="due">Due date
                  <input type="date" value={draftDue} onChange={(e) => setDraftDue(e.target.value)} />
                </label>
                <div className="actions">
                  <button type="submit" className="save">Save changes</button>
                  <button type="button" className="link" onClick={() => setEditingId(null)}>Cancel</button>
                </div>
              </form>
            ) : (
              <>
                <input type="checkbox" checked={t.done} aria-label={`Mark ${t.title} as done`} onChange={() => run(() => api(`/${t.id}`, "PATCH", { done: !t.done }))} />
                <div className={t.done ? "body done" : "body"}>
                  <strong>{t.title}</strong>
                  {t.content && <p>{t.content}</p>}
                  {t.dueDate && (
                    <span className={!t.done && t.dueDate < today() ? "date overdue" : "date"}>
                      {!t.done && t.dueDate < today() ? "Overdue: " : "Due "}{niceDate(t.dueDate)}
                    </span>
                  )}
                </div>
                <div className="actions">
                  <button className="link" onClick={() => startEdit(t)} aria-label={`Edit ${t.title}`}>Edit</button>
                  <button className="link delete" onClick={() => run(() => api(`/${t.id}`, "DELETE"))} aria-label={`Delete ${t.title}`}>Delete</button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
