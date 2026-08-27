"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createSubtask, deleteSubtask, toggleSubtask } from "@/lib/actions/subtasks";
import type { Subtask } from "@/types/database";

export function SubtaskList({ taskId }: { taskId: string }) {
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data, error: fetchError } = await supabase
      .from("subtasks")
      .select("*")
      .eq("task_id", taskId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });

    if (!fetchError) setSubtasks(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching subtasks for the modal's current task on mount/task change
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setError(null);
    try {
      await createSubtask(taskId, newTitle);
      setNewTitle("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add subtask");
    }
  }

  async function handleToggle(subtask: Subtask) {
    setSubtasks((prev) =>
      prev.map((s) => (s.id === subtask.id ? { ...s, is_completed: !s.is_completed } : s))
    );
    try {
      await toggleSubtask(subtask.id, !subtask.is_completed);
    } catch {
      await load();
    }
  }

  async function handleDelete(id: string) {
    setSubtasks((prev) => prev.filter((s) => s.id !== id));
    try {
      await deleteSubtask(id);
    } catch {
      await load();
    }
  }

  const completed = subtasks.filter((s) => s.is_completed).length;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Subtasks</h3>
        {subtasks.length > 0 && (
          <span className="text-xs text-muted">
            {completed} / {subtasks.length} completed
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : subtasks.length === 0 ? (
        <p className="text-sm text-muted">No subtasks yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {subtasks.map((subtask) => (
            <li key={subtask.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={subtask.is_completed}
                onChange={() => handleToggle(subtask)}
                className="h-4 w-4 rounded border-border accent-accent"
              />
              <span className={subtask.is_completed ? "flex-1 text-muted line-through" : "flex-1"}>
                {subtask.title}
              </span>
              <button
                type="button"
                onClick={() => handleDelete(subtask.id)}
                aria-label="Delete subtask"
                className="text-muted hover:text-danger"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="mt-3 flex gap-2">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add a subtask"
          className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-border/40"
        >
          <Plus size={14} />
          Add
        </button>
      </form>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
