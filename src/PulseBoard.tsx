import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { User } from "firebase/auth";
import { Link } from "react-router-dom";
import {
  createTask,
  logout,
  observeTasks,
  removeTask,
  updateTask,
  type Task,
  type TaskInput,
  type TaskStatus,
} from "./lib/tasks";

type AuthMode = "login" | "register";

const initialTask: TaskInput = {
  title: "",
  description: "",
  status: "todo",
  dueDate: "",
};

function formatDate(value: number) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

function statusLabel(status: TaskStatus) {
  return status === "todo" ? "To do" : status === "doing" ? "In progress" : "Done";
}

interface PulseBoardProps {
  user: User;
  onSignOut: () => void;
}

export default function PulseBoard({ user, onSignOut }: PulseBoardProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskError, setTaskError] = useState("");
  const [tasksLoading, setTasksLoading] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState<TaskInput>(initialTask);
  const [taskSaving, setTaskSaving] = useState(false);

  useEffect(() => {
    setTasksLoading(true);
    const unsubscribe = observeTasks(
      user.uid,
      (nextTasks) => {
        setTasks(nextTasks);
        setTasksLoading(false);
      },
      (message) => {
        setTaskError(message);
        setTasksLoading(false);
      },
    );

    return unsubscribe;
  }, [user]);

  const counts = useMemo(
    () => ({
      total: tasks.length,
      open: tasks.filter((task) => task.status !== "done").length,
      done: tasks.filter((task) => task.status === "done").length,
    }),
    [tasks],
  );

  async function handleTaskSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTaskError("");
    setTaskSaving(true);

    try {
      if (selectedTaskId) {
        await updateTask(user.uid, selectedTaskId, taskForm);
      } else {
        await createTask(user.uid, taskForm);
      }

      setTaskForm(initialTask);
      setSelectedTaskId(null);
    } catch (error) {
      setTaskError(error instanceof Error ? error.message : "Unable to save task.");
    } finally {
      setTaskSaving(false);
    }
  }

  async function handleDelete(taskId: string) {
    setTaskError("");

    try {
      await removeTask(user.uid, taskId);
      if (selectedTaskId === taskId) {
        setSelectedTaskId(null);
        setTaskForm(initialTask);
      }
    } catch (error) {
      setTaskError(error instanceof Error ? error.message : "Unable to delete task.");
    }
  }

  async function handleMarkAsDone(taskId: string) {
    setTaskError("");
    try {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;
      await updateTask(user.uid, taskId, {
        title: task.title,
        description: task.description,
        status: "done",
        dueDate: task.dueDate,
      });
    } catch (error) {
      setTaskError(error instanceof Error ? error.message : "Unable to update task.");
    }
  }

  function startEditing(task: Task) {
    setSelectedTaskId(task.id);
    setTaskForm({
      title: task.title,
      description: task.description,
      status: task.status,
      dueDate: task.dueDate,
    });
  }

  function clearForm() {
    setSelectedTaskId(null);
    setTaskForm(initialTask);
  }

  return (
    <main className="shell dashboard-shell">
      <header className="topbar panel">
        <div>
          <p className="eyebrow">PulseBoard</p>
          <h1>Welcome back{user.displayName ? `, ${user.displayName}` : ""}.</h1>
          <p className="muted">{user.email}</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <Link className="ghost-button" to="/">
            ← Apps
          </Link>
          <button className="ghost-button" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <section className="stats-grid">
        <article className="stat-card panel">
          <span>Total</span>
          <strong>{counts.total}</strong>
        </article>
        <article className="stat-card panel">
          <span>Open</span>
          <strong>{counts.open}</strong>
        </article>
        <article className="stat-card panel">
          <span>Done</span>
          <strong>{counts.done}</strong>
        </article>
      </section>

      <section className="content-grid">
        <form className="panel form-panel task-form" onSubmit={handleTaskSubmit}>
          <div className="panel-title-row">
            <div>
              <p className="eyebrow">{selectedTaskId ? "Edit task" : "New task"}</p>
              <h2>{selectedTaskId ? "Update your task" : "Add a task to the board"}</h2>
            </div>
            {selectedTaskId ? (
              <button type="button" className="ghost-button" onClick={clearForm}>
                Cancel
              </button>
            ) : null}
          </div>

          <label>
            Title
            <input
              value={taskForm.title}
              onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Finish assignment draft"
              required
            />
          </label>

          <label>
            Notes
            <textarea
              value={taskForm.description}
              onChange={(event) => setTaskForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Add context, links, or a quick next step"
              rows={4}
            />
          </label>

          <div className="inline-fields">
            <label>
              Status
              <select
                value={taskForm.status}
                onChange={(event) =>
                  setTaskForm((current) => ({ ...current, status: event.target.value as TaskStatus }))
                }
              >
                <option value="todo">To do</option>
                <option value="doing">In progress</option>
                <option value="done">Done</option>
              </select>
            </label>

            <label>
              Due date
              <input
                type="date"
                value={taskForm.dueDate}
                onChange={(event) => setTaskForm((current) => ({ ...current, dueDate: event.target.value }))}
              />
            </label>
          </div>

          {taskError ? <p className="status error">{taskError}</p> : null}

          <button className="primary-button" type="submit" disabled={taskSaving}>
            {taskSaving ? "Saving..." : selectedTaskId ? "Update task" : "Create task"}
          </button>
        </form>

        <section className="panel task-list-panel">
          <div className="panel-title-row">
            <div>
              <p className="eyebrow">Your tasks</p>
              <h2>Live Firestore data</h2>
            </div>
            {tasksLoading ? <span className="muted">Syncing...</span> : <span className="muted">{tasks.length} items</span>}
          </div>

          {tasks.length === 0 && !tasksLoading ? <p className="empty-state">No tasks yet. Create one to get started.</p> : null}

          <div className="task-list">
            {tasks.map((task) => (
              <article key={task.id} className="task-card">
                <div className="task-card-head">
                  <div>
                    <h3>{task.title}</h3>
                    <p className="muted">{statusLabel(task.status)}</p>
                  </div>
                  <span className={`status-pill ${task.status}`}>{statusLabel(task.status)}</span>
                </div>

                {task.description ? <p className="task-description">{task.description}</p> : null}
                <div className="task-meta">
                  <span>Created {formatDate(task.createdAt)}</span>
                  {task.dueDate ? <span>Due {task.dueDate}</span> : null}
                </div>

                <div className="task-actions">
                  {task.status !== "done" && (
                    <button className="primary-button" onClick={() => void handleMarkAsDone(task.id)}>
                      ✓ Done
                    </button>
                  )}
                  <button className="ghost-button" onClick={() => startEditing(task)}>
                    Edit
                  </button>
                  <button className="danger-button" onClick={() => void handleDelete(task.id)}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
