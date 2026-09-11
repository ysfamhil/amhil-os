"use client";

import clsx from "clsx";
import { Badge, priorityTone } from "@/components/ui/badge";
import { DashboardTaskCheckbox } from "./dashboard-task-checkbox";
import { DragHandle } from "./drag-handle";
import { WidgetShell, WidgetAddButton } from "./widget-shell";
import { useCompletedTasks } from "@/lib/hooks/use-completed-tasks";
import { useDragReorder } from "@/lib/hooks/use-drag-reorder";
import { reorderTasks } from "@/lib/actions/tasks";
import { todayISODate } from "@/lib/dates";
import type { DashboardData } from "@/lib/dashboard";
import type { TaskPriority } from "@/types/database";

interface TodayTask {
  id: string;
  title: string;
  priority: TaskPriority;
  due_date: string | null;
  category: string | null;
}

function formatDue(date: string | null, today: string) {
  if (!date) return null;
  if (date === today) return "Today";
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function TodayWidget({
  data,
  onAddTask,
}: {
  data: DashboardData;
  onAddTask: () => void;
}) {
  const { merge, markDone, isDone } = useCompletedTasks<TodayTask>();
  const today = todayISODate();

  const priorities = merge(data.today.priorities);
  const overdueTasks = merge(data.today.overdueTasks);
  const overdueIds = new Set(data.today.overdueTasks.map((t) => t.id));
  const allTasks = merge(data.today.tasks).filter((t) => !overdueIds.has(t.id));

  const { list: todayTasks, draggingId, handleDragStart, handleDragOver, handleDragEnd } = useDragReorder(
    allTasks,
    reorderTasks
  );

  return (
    <WidgetShell
      title="Tasks"
      action={<WidgetAddButton onClick={onAddTask} label="Task" domain="tasks" />}
      domain="tasks"
      className="h-full"
      bodyClassName="px-[15px] py-[12px]"
    >
      <div className="flex flex-col gap-4">
        {priorities.length > 0 && (
          <section>
            <p className="mb-1.5 text-[10.5px] font-medium uppercase tracking-[0.07em] text-t5">Priorities</p>
            <ul className="flex flex-col gap-1">
              {priorities.map((task) => {
                const done = isDone(task.id);
                return (
                  <li key={task.id} className="flex items-center gap-2">
                    <DashboardTaskCheckbox taskId={task.id} completed={done} onToggle={() => markDone(task)} />
                    <span className={clsx("min-w-0 flex-1 truncate text-[12.5px]", done && "text-t6 line-through")}>
                      {task.title}
                    </span>
                    <Badge tone={priorityTone(task.priority)}>{task.priority}</Badge>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section>
          <p className="mb-1.5 text-[10.5px] font-medium uppercase tracking-[0.07em] text-t5">
            Tasks {todayTasks.length > 0 && `(${todayTasks.length})`}
          </p>
          {todayTasks.length === 0 ? (
            <p className="text-[12.5px] text-t6">Nothing open.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {todayTasks.map((task) => {
                const done = isDone(task.id);
                const due = formatDue(task.due_date, today);
                return (
                  <li
                    key={task.id}
                    onDragOver={(e) => handleDragOver(task.id, e)}
                    className={clsx(
                      "group flex items-center gap-1 rounded-[7px]",
                      draggingId === task.id && "opacity-40"
                    )}
                  >
                    <DragHandle onDragStart={() => handleDragStart(task.id)} onDragEnd={handleDragEnd} />
                    <DashboardTaskCheckbox taskId={task.id} completed={done} onToggle={() => markDone(task)} />
                    <span className={clsx("min-w-0 flex-1 truncate text-[12.5px]", done && "text-t6 line-through")}>
                      {task.title}
                    </span>
                    {due && <span className="shrink-0 font-mono text-[10px] text-t7">{due}</span>}
                    {task.category && <span className="shrink-0 font-mono text-[10px] text-t7">{task.category}</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {overdueTasks.length > 0 && (
          <section>
            <p className="mb-1.5 text-[10.5px] font-medium uppercase tracking-[0.07em] text-red">
              Overdue ({overdueTasks.length})
            </p>
            <ul className="flex flex-col gap-1">
              {overdueTasks.map((task) => {
                const done = isDone(task.id);
                return (
                  <li key={task.id} className="flex items-center gap-2">
                    <DashboardTaskCheckbox taskId={task.id} completed={done} onToggle={() => markDone(task)} />
                    <span className={clsx("min-w-0 flex-1 truncate text-[12.5px]", done && "text-t6 line-through")}>
                      {task.title}
                    </span>
                    <span className={clsx("shrink-0 font-mono text-[10.5px]", done ? "text-t6 line-through" : "text-red")}>
                      {task.due_date}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </WidgetShell>
  );
}
