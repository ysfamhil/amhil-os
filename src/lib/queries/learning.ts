import type { SupabaseClient } from "@supabase/supabase-js";
import { startOfMonthISODate, startOfWeekISODate } from "@/lib/dates";
import type { Database, LearningArea, LearningSession, LearningTopic } from "@/types/database";

function sumMinutes(sessions: { duration_minutes: number }[]) {
  return sessions.reduce((total, s) => total + s.duration_minutes, 0);
}

export interface AreaWithStats extends LearningArea {
  topicCount: number;
  activeTopicCount: number;
  totalMinutes: number;
}

export async function getLearningAreas(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<AreaWithStats[]> {
  const { data: areas, error } = await supabase
    .from("learning_areas")
    .select("*")
    .eq("user_id", userId)
    .order("name");

  if (error) throw new Error(error.message);
  if (!areas || areas.length === 0) return [];

  const areaIds = areas.map((a) => a.id);

  const { data: topics } = await supabase
    .from("learning_topics")
    .select("id,area_id,status")
    .eq("user_id", userId)
    .in("area_id", areaIds);

  const topicList = (topics ?? []) as Pick<LearningTopic, "id" | "area_id" | "status">[];
  const topicIds = topicList.map((t) => t.id);

  const { data: sessions } = topicIds.length
    ? await supabase.from("learning_sessions").select("topic_id,duration_minutes").eq("user_id", userId).in("topic_id", topicIds)
    : { data: [] };

  const sessionList = (sessions ?? []) as { topic_id: string; duration_minutes: number }[];

  return areas.map((area) => {
    const areaTopics = topicList.filter((t) => t.area_id === area.id);
    const areaTopicIds = new Set(areaTopics.map((t) => t.id));
    const areaSessions = sessionList.filter((s) => areaTopicIds.has(s.topic_id));
    return {
      ...area,
      topicCount: areaTopics.length,
      activeTopicCount: areaTopics.filter((t) => t.status === "Learning" || t.status === "Practicing").length,
      totalMinutes: sumMinutes(areaSessions),
    };
  });
}

export interface TopicWithStats extends LearningTopic {
  totalMinutes: number;
  sessionCount: number;
}

export async function getAreaById(
  supabase: SupabaseClient<Database>,
  userId: string,
  id: string
): Promise<{ area: LearningArea; topics: TopicWithStats[] } | null> {
  const { data: area, error } = await supabase
    .from("learning_areas")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!area) return null;

  const { data: topics } = await supabase
    .from("learning_topics")
    .select("*")
    .eq("user_id", userId)
    .eq("area_id", id)
    .order("created_at", { ascending: false });

  const topicList = (topics ?? []) as LearningTopic[];
  const topicIds = topicList.map((t) => t.id);

  const { data: sessions } = topicIds.length
    ? await supabase.from("learning_sessions").select("topic_id,duration_minutes").eq("user_id", userId).in("topic_id", topicIds)
    : { data: [] };

  const sessionList = (sessions ?? []) as { topic_id: string; duration_minutes: number }[];

  const withStats = topicList.map((topic) => {
    const topicSessions = sessionList.filter((s) => s.topic_id === topic.id);
    return { ...topic, totalMinutes: sumMinutes(topicSessions), sessionCount: topicSessions.length };
  });

  return { area, topics: withStats };
}

export async function getTopicById(
  supabase: SupabaseClient<Database>,
  userId: string,
  id: string
): Promise<{ topic: TopicWithStats; area: LearningArea; sessions: LearningSession[] } | null> {
  const { data: topic, error } = await supabase
    .from("learning_topics")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!topic) return null;

  const [areaRes, sessionsRes] = await Promise.all([
    supabase.from("learning_areas").select("*").eq("user_id", userId).eq("id", topic.area_id).single(),
    supabase
      .from("learning_sessions")
      .select("*")
      .eq("user_id", userId)
      .eq("topic_id", id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  const sessions = (sessionsRes.data ?? []) as LearningSession[];

  return {
    topic: { ...topic, totalMinutes: sumMinutes(sessions), sessionCount: sessions.length },
    area: areaRes.data as LearningArea,
    sessions,
  };
}

export interface LearningOverview {
  totalMinutes: number;
  weekMinutes: number;
  monthMinutes: number;
  activeTopics: (LearningTopic & { areaName: string })[];
  recentSessions: (LearningSession & { topicName: string; areaName: string })[];
}

export async function getLearningOverview(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<LearningOverview> {
  const weekStart = startOfWeekISODate();
  const monthStart = startOfMonthISODate();

  const [allSessionsRes, activeTopicsRes, recentSessionsRes] = await Promise.all([
    supabase.from("learning_sessions").select("date,duration_minutes").eq("user_id", userId),
    supabase
      .from("learning_topics")
      .select("*, learning_areas(name)")
      .eq("user_id", userId)
      .in("status", ["Learning", "Practicing"])
      .order("updated_at", { ascending: false })
      .limit(6),
    supabase
      .from("learning_sessions")
      .select("*, learning_topics(name, learning_areas(name))")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const allSessions = (allSessionsRes.data ?? []) as { date: string; duration_minutes: number }[];

  const activeTopics = ((activeTopicsRes.data ?? []) as unknown as (LearningTopic & {
    learning_areas: { name: string } | null;
  })[]).map((t) => ({ ...t, areaName: t.learning_areas?.name ?? "" }));

  const recentSessions = ((recentSessionsRes.data ?? []) as unknown as (LearningSession & {
    learning_topics: { name: string; learning_areas: { name: string } | null } | null;
  })[]).map((s) => ({
    ...s,
    topicName: s.learning_topics?.name ?? "",
    areaName: s.learning_topics?.learning_areas?.name ?? "",
  }));

  return {
    totalMinutes: sumMinutes(allSessions),
    weekMinutes: sumMinutes(allSessions.filter((s) => s.date >= weekStart)),
    monthMinutes: sumMinutes(allSessions.filter((s) => s.date >= monthStart)),
    activeTopics,
    recentSessions,
  };
}
