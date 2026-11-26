"use server";

import { revalidatePath } from "next/cache";
import { requireApprovedSession } from "@/lib/auth";
import { logTimelineEvent } from "@/lib/timeline";
import {
  AREA_FIELDS, RELATIONS, SESSION_FIELDS, TOPIC_FIELDS,
  assertOwnedRelations, assertUuid, pickWritable,
} from "@/lib/write-fields";
import type { LearningTopicStatus } from "@/types/database";

function revalidateLearningPaths(areaId?: string, topicId?: string) {
  revalidatePath("/app/learning");
  revalidatePath("/app/dashboard");
  if (areaId) revalidatePath(`/app/learning/${areaId}`);
  if (areaId && topicId) revalidatePath(`/app/learning/${areaId}/topics/${topicId}`);
}

// --- Areas ---------------------------------------------------------------

export interface AreaInput {
  name: string;
  description?: string | null;
}

export async function createArea(input: AreaInput) {
  const { supabase, user } = await requireApprovedSession();
  const fields = pickWritable(AREA_FIELDS, input);
  const name = typeof fields.name === "string" ? fields.name.trim() : "";
  if (!name) throw new Error("Name is required");

  const { data, error } = await supabase
    .from("learning_areas")
    .insert({ ...fields, name, user_id: user.id })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidateLearningPaths();
  return data;
}

export async function updateArea(id: string, input: Partial<AreaInput>) {
  const { supabase, user } = await requireApprovedSession();
  assertUuid(id, "Area");
  const patch = pickWritable(AREA_FIELDS, input);
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
  const { supabase, user } = await requireApprovedSession();
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
  const { supabase, user } = await requireApprovedSession();
  // started_at / completed_at are server-managed (derived from status below) and never accepted from the client.
  const fields = pickWritable(TOPIC_FIELDS, input);
  const name = typeof fields.name === "string" ? fields.name.trim() : "";
  if (!name) throw new Error("Name is required");
  assertUuid(fields.area_id, "Area");
  validateConfidence(fields.confidence);
  await assertOwnedRelations(supabase, user.id, RELATIONS.learning_topics, fields);

  const patch: TopicInput & { user_id: string; started_at?: string; completed_at?: string } = {
    ...fields,
    area_id: fields.area_id,
    name,
    user_id: user.id,
    goal_id: fields.goal_id || null,
  };
  if (fields.status && fields.status !== "Not Started") {
    patch.started_at = new Date().toISOString();
  }
  if (fields.status === "Completed") patch.completed_at = new Date().toISOString();

  const { data, error } = await supabase.from("learning_topics").insert(patch).select("id").single();

  if (error) throw new Error(error.message);
  revalidateLearningPaths(fields.area_id);
  return data;
}

export async function updateTopic(id: string, areaId: string, input: Partial<TopicInput>) {
  const { supabase, user } = await requireApprovedSession();
  assertUuid(id, "Topic");
  assertUuid(areaId, "Area");
  const fields = pickWritable(TOPIC_FIELDS, input);
  validateConfidence(fields.confidence);
  await assertOwnedRelations(supabase, user.id, RELATIONS.learning_topics, fields);

  let previousStatus: LearningTopicStatus | null = null;
  if (fields.status) {
    const { data: existing } = await supabase
      .from("learning_topics")
      .select("status")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    previousStatus = existing?.status ?? null;
  }

  const patch: Partial<TopicInput> & { completed_at?: string | null } = { ...fields };
  if (typeof patch.name === "string") {
    const name = patch.name.trim();
    if (!name) throw new Error("Name is required");
    patch.name = name;
  }
  if ("goal_id" in fields) patch.goal_id = fields.goal_id || null;
  if (fields.status) {
    patch.completed_at = fields.status === "Completed" ? new Date().toISOString() : null;
    // "Completed" and "100% progress" are the same fact — enforce that
    // invariant server-side rather than trusting whatever progress value
    // happened to be in the form when status was changed, otherwise a topic
    // can be marked Completed while still showing a stale progress% (the
    // exact bug this replaced: a topic saved as Completed at 40% stayed at
    // 40% forever because the form always submits a concrete number, never
    // omits the field).
    if (fields.status === "Completed") patch.progress = 100;
  }

  const { data, error } = await supabase
    .from("learning_topics")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("name")
    .single();

  if (error) throw new Error(error.message);

  if (fields.status === "Completed" && previousStatus !== "Completed") {
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
  const { supabase, user } = await requireApprovedSession();
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
  const { supabase, user } = await requireApprovedSession();
  assertUuid(areaId, "Area");
  const fields = pickWritable(SESSION_FIELDS, input);
  if (typeof fields.duration_minutes !== "number" || fields.duration_minutes <= 0) throw new Error("Duration must be positive");
  const durationMinutes = fields.duration_minutes;
  assertUuid(fields.topic_id, "Topic");
  const topicId = fields.topic_id;
  validateConfidence(fields.confidence_before);
  validateConfidence(fields.confidence_after);

  const { data: topic } = await supabase
    .from("learning_topics")
    .select("name")
    .eq("id", topicId)
    .eq("user_id", user.id)
    .single();
  if (!topic) throw new Error("Topic not found");

  const { error } = await supabase
    .from("learning_sessions")
    .insert({ ...fields, topic_id: topicId, duration_minutes: durationMinutes, user_id: user.id });
  if (error) throw new Error(error.message);

  if (fields.confidence_after != null) {
    await supabase.from("learning_topics").update({ confidence: fields.confidence_after }).eq("id", topicId).eq("user_id", user.id);
  }

  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  const durationLabel = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  await logTimelineEvent(supabase, user.id, {
    eventType: "learning_session_logged",
    title: `${durationLabel} learning session — ${topic.name}`,
    relatedEntityType: "learning_topic",
    relatedEntityId: topicId,
    occurredAt: fields.date ? new Date(fields.date).toISOString() : undefined,
    metadata: { duration_minutes: durationMinutes, area_id: areaId },
  });

  revalidateLearningPaths(areaId, topicId);
}

export async function updateSession(id: string, areaId: string, topicId: string, input: Partial<SessionInput>) {
  const { supabase, user } = await requireApprovedSession();
  assertUuid(id, "Session");
  assertUuid(areaId, "Area");
  assertUuid(topicId, "Topic");
  const fields = pickWritable(SESSION_FIELDS, input);
  if (fields.duration_minutes != null && fields.duration_minutes <= 0) {
    throw new Error("Duration must be positive");
  }
  validateConfidence(fields.confidence_before);
  validateConfidence(fields.confidence_after);
  await assertOwnedRelations(supabase, user.id, RELATIONS.learning_sessions, fields);

  const { error } = await supabase.from("learning_sessions").update(fields).eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidateLearningPaths(areaId, topicId);
}

export async function deleteSession(id: string, areaId: string, topicId: string) {
  const { supabase, user } = await requireApprovedSession();
  const { error } = await supabase.from("learning_sessions").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidateLearningPaths(areaId, topicId);
}
