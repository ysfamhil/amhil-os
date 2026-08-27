import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/dashboard";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, priorityTone } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { DashboardHabitToggle } from "@/components/dashboard/dashboard-habit-toggle";
import { DashboardInsights } from "@/components/dashboard/dashboard-insights";
import { runAutomationChecks } from "@/lib/automation";

function money(amount: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount);
}

function hours(value: number) {
  return `${value.toFixed(1)}h`;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [data] = await Promise.all([getDashboardData(supabase, user.id), runAutomationChecks(supabase, user.id)]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted">Your life and work, in one place.</p>
      </div>

      {/* Today */}
      <Card>
        <CardHeader
          title="Today"
          action={
            <Link href="/tasks" className="text-xs font-medium text-accent hover:underline">
              View all tasks
            </Link>
          }
        />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <p className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted">
              <span>Today&apos;s tasks ({data.today.tasks.length})</span>
              <span className="normal-case text-success">{data.today.completedToday} completed today</span>
            </p>
            {data.today.tasks.length === 0 ? (
              <p className="text-sm text-muted">Nothing due today.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {data.today.tasks.map((task) => (
                  <li key={task.id} className="flex items-center justify-between text-sm">
                    <Link href="/tasks?tab=today" className="hover:underline">
                      {task.title}
                    </Link>
                    <Badge tone={priorityTone(task.priority)}>{task.priority}</Badge>
                  </li>
                ))}
              </ul>
            )}

            {data.today.overdueTasks.length > 0 && (
              <>
                <p className="mb-2 mt-4 text-xs font-medium uppercase tracking-wide text-danger">
                  Overdue ({data.today.overdueTasks.length})
                </p>
                <ul className="flex flex-col gap-2">
                  {data.today.overdueTasks.map((task) => (
                    <li key={task.id} className="flex items-center justify-between text-sm">
                      <span>{task.title}</span>
                      <span className="text-xs text-muted">{task.due_date}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
              Today&apos;s habits ({data.today.habits.length})
            </p>
            {data.today.habits.length === 0 ? (
              <p className="text-sm text-muted">No active habits yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {data.today.habits.map((habit) => (
                  <li key={habit.id}>
                    <DashboardHabitToggle
                      habitId={habit.id}
                      name={habit.name}
                      completedToday={habit.completedToday}
                    />
                  </li>
                ))}
              </ul>
            )}

            <p className="mb-2 mt-4 text-xs font-medium uppercase tracking-wide text-muted">
              Priorities
            </p>
            {data.today.priorities.length === 0 ? (
              <p className="text-sm text-muted">No high-priority tasks open.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {data.today.priorities.map((task) => (
                  <li key={task.id} className="flex items-center justify-between text-sm">
                    <span>{task.title}</span>
                    <Badge tone={priorityTone(task.priority)}>{task.priority}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Card>

      {/* This Week */}
      <Card>
        <CardHeader title="This Week" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Stat label="Tasks completed" value={String(data.week.tasksCompleted)} />
          <Stat label="Hours worked" value={hours(data.week.hoursWorked)} />
          <Stat label="Learning hours" value={hours(data.week.learningHours)} />
          <Stat label="Habit consistency" value={`${data.week.habitConsistency}%`} />
          <Stat label="Income" value={`${money(data.week.income)} MAD`} />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Active Projects */}
        <Card>
          <CardHeader
            title="Active Projects"
            action={
              <Link href="/projects" className="text-xs font-medium text-accent hover:underline">
                View all
              </Link>
            }
          />
          {data.activeProjects.length === 0 ? (
            <p className="text-sm text-muted">No active projects yet.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {data.activeProjects.map((project) => (
                <li key={project.id}>
                  <Link href={`/projects/${project.id}`} className="mb-1 flex items-center justify-between text-sm hover:underline">
                    <span className="font-medium">{project.name}</span>
                    <span className="text-xs text-muted">{project.progress}%</span>
                  </Link>
                  <ProgressBar value={project.progress} />
                  <div className="mt-1.5 flex justify-between text-xs text-muted">
                    <span>{hours(project.hoursInvested)} invested</span>
                    <span>{money(project.revenue)} MAD revenue</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Learning */}
        <Card>
          <CardHeader
            title="Learning"
            action={
              <Link href="/learning" className="text-xs font-medium text-accent hover:underline">
                View all
              </Link>
            }
          />
          {data.learning.currentTopics.length === 0 ? (
            <p className="text-sm text-muted">No topics in progress yet.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {data.learning.currentTopics.map((topic) => (
                <li key={topic.id}>
                  <Link
                    href={`/learning/${topic.area_id}/topics/${topic.id}`}
                    className="mb-1 flex items-center justify-between text-sm hover:underline"
                  >
                    <span className="font-medium">{topic.name}</span>
                    <span className="text-xs text-muted">{topic.progress}%</span>
                  </Link>
                  <ProgressBar value={topic.progress} />
                  <p className="mt-1 text-xs text-muted">{topic.areaName}</p>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-muted">
            Total study time: {hours(data.learning.totalStudyHours)}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Goals */}
        <Card>
          <CardHeader
            title="Goals"
            action={
              <Link href="/goals" className="text-xs font-medium text-accent hover:underline">
                View all
              </Link>
            }
          />
          <div className="mb-3 text-sm text-muted">{data.goals.active} active goal{data.goals.active === 1 ? "" : "s"}</div>
          {data.goals.nearingDeadline.length === 0 ? (
            <p className="text-sm text-muted">Nothing nearing its deadline in the next two weeks.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.goals.nearingDeadline.map((goal) => (
                <li key={goal.id}>
                  <Link href={`/goals/${goal.id}`} className="mb-1 flex items-center justify-between text-sm hover:underline">
                    <span className="font-medium">{goal.title}</span>
                    <span className="text-xs text-warning">{goal.target_date}</span>
                  </Link>
                  <ProgressBar value={goal.progress} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Habits */}
        <Card>
          <CardHeader
            title="Habits"
            action={
              <Link href="/habits" className="text-xs font-medium text-accent hover:underline">
                View all
              </Link>
            }
          />
          <div className="mb-3 flex items-center justify-between text-sm text-muted">
            <span>
              {data.habitsToday.completed}/{data.habitsToday.total} done today
            </span>
          </div>
          {data.habitsToday.list.length === 0 ? (
            <p className="text-sm text-muted">No active habits yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.habitsToday.list.map((habit) => (
                <li key={habit.id} className="flex items-center justify-between text-sm">
                  <DashboardHabitToggle
                    habitId={habit.id}
                    name={habit.name}
                    completedToday={habit.completedToday}
                  />
                  <span className="ml-3 shrink-0 text-xs text-muted">🔥{habit.currentStreak}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Time */}
      <Card>
        <CardHeader
          title="Time"
          action={
            <Link href="/time" className="text-xs font-medium text-accent hover:underline">
              View all
            </Link>
          }
        />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Today" value={hours(data.time.todayHours)} />
          <Stat label="This week" value={hours(data.time.weekHours)} />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Clients */}
        <Card>
          <CardHeader
            title="Clients"
            action={
              <Link href="/clients" className="text-xs font-medium text-accent hover:underline">
                View all
              </Link>
            }
          />
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Active clients" value={String(data.clients.active)} />
            <Stat label="New this month" value={String(data.clients.newThisMonth)} />
          </div>
        </Card>

        {/* Leads */}
        <Card>
          <CardHeader
            title="Leads"
            action={
              <Link href="/leads" className="text-xs font-medium text-accent hover:underline">
                View all
              </Link>
            }
          />
          <div className="grid grid-cols-3 gap-4">
            <Stat label="Open leads" value={String(data.leads.open)} />
            <Stat label="Pipeline value" value={`${money(data.leads.pipelineValue)} MAD`} />
            <Stat label="Won" value={String(data.leads.won)} tone="success" />
          </div>
        </Card>
      </div>

      {/* Finance */}
      <Card>
        <CardHeader
          title="Finance"
          action={
            <Link href="/finance" className="text-xs font-medium text-accent hover:underline">
              View all
            </Link>
          }
        />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Revenue (paid, this month)" value={`${money(data.finance.monthRevenue)} MAD`} tone="success" />
          <Stat label="Expenses (this month)" value={`${money(data.finance.monthExpenses)} MAD`} />
          <Stat
            label="Net income"
            value={`${money(data.finance.netIncome)} MAD`}
            tone={data.finance.netIncome >= 0 ? "success" : "danger"}
          />
          <Stat label="Expected income" value={`${money(data.finance.expectedIncome)} MAD`} />
        </div>
      </Card>

      <DashboardInsights data={data} />

      {/* Explore */}
      <Card>
        <CardHeader title="Explore" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Link
            href="/reports"
            className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm font-medium hover:border-accent hover:text-accent"
          >
            View full reports
            <span aria-hidden="true">→</span>
          </Link>
          <Link
            href="/timeline"
            className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm font-medium hover:border-accent hover:text-accent"
          >
            View timeline
            <span aria-hidden="true">→</span>
          </Link>
          <Link
            href="/search"
            className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm font-medium hover:border-accent hover:text-accent"
          >
            Search everything
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </Card>

      <QuickActions />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "danger";
}) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p
        className={`mt-1 text-lg font-semibold ${
          tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
