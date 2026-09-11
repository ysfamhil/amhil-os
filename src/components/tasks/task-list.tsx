import { TaskRow } from "./task-row";
import { addDaysISODate, todayISODate } from "@/lib/dates";
import type { SubtaskProgress } from "@/lib/queries/tasks";
import type { Task, TaskStatus } from "@/types/database";

interface Group {
  key: string;
  label: string;
  color: string;
  tasks: Task[];
}

function groupByDueDate(tasks: Task[]): Group[] {
  const today = todayISODate();
  const weekEnd = addDaysISODate(6, new Date());

  const overdue: Task[] = [];
  const todayGroup: Task[] = [];
  const thisWeek: Task[] = [];
  const later: Task[] = [];

  for (const task of tasks) {
    if (!task.due_date) {
      later.push(task);
    } else if (task.due_date < today && task.status !== "Done" && task.status !== "Cancelled") {
      overdue.push(task);
    } else if (task.due_date === today) {
      todayGroup.push(task);
    } else if (task.due_date <= weekEnd) {
      thisWeek.push(task);
    } else {
      later.push(task);
    }
  }

  return [
    { key: "overdue", label: "Overdue", color: "var(--domain-danger)", tasks: overdue },
    { key: "today", label: "Today", color: "var(--domain-tasks)", tasks: todayGroup },
    { key: "week", label: "This week", color: "var(--domain-time)", tasks: thisWeek },
    { key: "later", label: "Later", color: "var(--t6)", tasks: later },
  ].filter((g) => g.tasks.length > 0);
}

function GroupHeader({ label, color, count }: { label: string; color: string; count: number }) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-2 bg-surface px-[13px] py-[7px]">
      <span className="h-[6px] w-[6px] shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="shrink-0 text-[12px] font-bold uppercase tracking-[0.11em]" style={{ color }}>
        {label}
      </span>
      <span className="shrink-0 font-mono text-[11px] text-t7">{count}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

export function TaskList({
  tasks,
  grouped,
  subtaskProgress,
  timeLogged,
  isDone,
  onToggleComplete,
  onEdit,
  onRequestDelete,
  onStatusChanged,
}: {
  tasks: Task[];
  grouped: boolean;
  subtaskProgress: Record<string, SubtaskProgress>;
  timeLogged: Record<string, number>;
  isDone: (id: string) => boolean;
  onToggleComplete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onRequestDelete: (task: Task) => void;
  onStatusChanged: (task: Task, status: TaskStatus) => void;
}) {
  function renderRow(task: Task) {
    return (
      <TaskRow
        key={task.id}
        task={task}
        subtaskProgress={subtaskProgress[task.id]}
        minutesLogged={timeLogged[task.id]}
        completed={isDone(task.id)}
        onToggleComplete={() => onToggleComplete(task)}
        onEdit={() => onEdit(task)}
        onRequestDelete={() => onRequestDelete(task)}
        onStatusChanged={(status) => onStatusChanged(task, status)}
      />
    );
  }

  if (!grouped) {
    return (
      <div className="overflow-hidden rounded-[16px] border border-line bg-surface">
        {tasks.map(renderRow)}
      </div>
    );
  }

  const groups = groupByDueDate(tasks);

  return (
    <div className="overflow-hidden rounded-[16px] border border-line bg-surface">
      {groups.map((group) => (
        <div key={group.key}>
          <GroupHeader label={group.label} color={group.color} count={group.tasks.length} />
          {group.tasks.map(renderRow)}
        </div>
      ))}
    </div>
  );
}
