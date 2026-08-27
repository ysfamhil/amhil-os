"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logTimelineEvent } from "@/lib/timeline";
import type { LearningTopicStatus } from "@/types/database";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

function revalidateLearningPaths(areaId?: string, topicId?: string) {
  revalidatePath("/learning");
  revalidatePath("/dashboard");
  if (areaId) revalidatePath(`/learning/${areaId}`);
  if (areaId && topicId) revalidatePath(`/learning/${areaId}/topics/${topicId}`);
}

// --- Areas ---------------------------------------------------------------

export interface AreaInput {
  name: string;
  description?: string | null;
}

export async function createArea(input: AreaInput) {
  const { supabase, user } = await requireUser();
  const name = input.name.trim();
  if (!name) throw new Error("Name is required");

  const { data, error } = await supabase
    .from("learning_areas")
    .insert({ ...input, name, user_id: user.id })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidateLearningPaths();
  return data;
}

export async function updateArea(id: string, input: Partial<AreaInput>) {
  const { supabase, user } = await requireUser();
  const patch = { ...input };
  if (typeof patch.name === "string") {
    const name = patch.name.trim();
    if (!name) throw new Error("Name is required");
    patch.name = name;
  }

  const { error } = await supabase.from("learning_areas").update(patch).eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidateLearningPaths(id);
}

export async function deleteArea(id: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("learning_areas").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidateLearningPaths();
}

// --- Topics ----------------------------------------------------------------

export interface TopicInput {
  area_id: string;
  name: string;
  status?: LearningTopicStatus;
  progress?: number;
  confidence?: number | null;
  goal_id?: string | null;
  notes?: string | null;
}

function validateConfidence(confidence: number | null | undefined) {
  if (confidence != null && (confidence < 1 || confidence > 10)) {
    throw new Error("Confidence must be between 1 and 10");
  }
}

export async function createTopic(input: TopicInput) {
  const { supabase, user } = await requireUser();
  const name = input.name.trim();
  if (!name) throw new Error("Name is required");
  validateConfidence(input.confidence);

  const patch: TopicInput & { user_id: string; started_at?: string; completed_at?: string } = {
    ...input,
    name,
    user_id: user.id,
    goal_id: input.goal_id || null,
  };
  if (input.status && input.status !== "Not Started" && !patch.started_at) {
    patch.started_at = new Date().toISOString();
  }
  if (input.status === "Completed") patch.completed_at = new Date().toISOString();

  const { data, error } = await supabase.from("learning_topics").insert(patch).select("id").single();

  if (error) throw new Error(error.message);
  revalidateLearningPaths(input.area_id);
  return data;
}

export async function updateTopic(id: string, areaId: string, input: Partial<TopicInput>) {
  const { supabase, user } = await requireUser();
  validateConfidence(input.confidence);

  let previousStatus: LearningTopicStatus | null = null;
  if (input.status) {
    const { data: existing } = await supabase
      .from("learning_topics")
      .select("status")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    previousStatus = existing?.status ?? null;
  }

  const patch: Partial<TopicInput> & { completed_at?: string | null } = { ...input };
  if (typeof patch.name === "string") {
    const name = patch.name.trim();
    if (!name) throw new Error("Name is required");
    patch.name = name;
  }
  if ("goal_id" in input) patch.goal_id = input.goal_id || null;
  if (input.status) {
    patch.completed_at = input.status === "Completed" ? new Date().toISOString() : null;
    // "Completed" and "100% progress" are the same fact — enforce that
    // invariant server-side rather than trusting whatever progress value
    // happened to be in the form when status was changed, otherwise a topic
    // can be marked Completed while still showing a stale progress% (the
    // exact bug this replaced: a topic saved as Completed at 40% stayed at
    // 40% forever because the form always submits a concrete number, never
    // omits the field).
    if (input.status === "Completed") patch.progress = 100;
  }

  const { data, error } = await supabase
    .from("learning_topics")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("name")
    .single();

  if (error) throw new Error(error.message);

  if (input.status === "Completed" && previousStatus !== "Completed") {
    await logTimelineEvent(supabase, user.id, {
      eventType: "learning_topic_completed",
      title: `Completed topic "${data.name}"`,
      relatedEntityType: "learning_topic",
      relatedEntityId: id,
      metadata: { area_id: areaId },
    });
  }

  revalidateLearningPaths(areaId, id);
}

export async function deleteTopic(id: string, areaId: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("learning_topics").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidateLearningPaths(areaId);
}

// --- Sessions ----------------------------------------------------------------

export interface SessionInput {
  topic_id: string;
  date?: string;
  duration_minutes: number;
  notes?: string | null;
  what_learned?: string | null;
  confidence_before?: number | null;
  confidence_after?: number | null;
}

export async function createSession(input: SessionInput, areaId: string) {
  const { supabase, user } = await requireUser();
  if (input.duration_minutes <= 0) throw new Error("Duration must be positive");
  validateConfidence(input.confidence_before);
  validateConfidence(input.confidence_after);

  const { data: topic } = await supabase
    .from("learning_topics")
    .select("name")
    .eq("id", input.topic_id)
    .eq("user_id", user.id)
    .single();
  if (!topic) throw new Error("Topic not found");

  const { error } = await supabase.from("learning_sessions").insert({ ...input, user_id: user.id });
  if (error) throw new Error(error.message);

  if (input.confidence_after != null) {
    await supabase.from("learning_topics").update({ confidence: input.confidence_after }).eq("id", input.topic_id).eq("user_id", user.id);
  }

  const hours = Math.floor(input.duration_minutes / 60);
  const minutes = input.duration_minutes % 60;
  const durationLabel = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  await logTimelineEvent(supabase, user.id, {
    eventType: "learning_session_logged",
    title: `${durationLabel} learning session — ${topic.name}`,
    relatedEntityType: "learning_topic",
    relatedEntityId: input.topic_id,
    occurredAt: input.date ? new Date(input.date).toISOString() : undefined,
    metadata: { duration_minutes: input.duration_minutes, area_id: areaId },
  });

  revalidateLearningPaths(areaId, input.topic_id);
}

export async function updateSession(id: string, areaId: string, topicId: string, input: Partial<SessionInput>) {
  const { supabase, user } = await requireUser();
  if (input.duration_minutes != null && input.duration_minutes <= 0) {
    throw new Error("Duration must be positive");
  }
  validateConfidence(input.confidence_before);
  validateConfidence(input.confidence_after);

  const { error } = await supabase.from("learning_sessions").update(input).eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidateLearningPaths(areaId, topicId);
}

export async function deleteSession(id: string, areaId: string, topicId: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("learning_sessions").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidateLearningPaths(areaId, topicId);
}
