"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { extractErrorMessage } from "@/components/api/apiFuntions";
import {
  createJobActivity,
  deleteJobActivity,
  updateJobActivity,
} from "@/lib/api/crm-client";
import type { EstimateActivity } from "@/lib/types";

function activitiesFingerprint(list?: EstimateActivity[]) {
  if (!list) return "";
  return list
    .map((item) => `${item.id}:${item.updatedAt || item.createdAt}:${item.title}`)
    .join("|");
}

export function useJobActivities(
  jobId?: string,
  enabled = true,
  initialActivities?: EstimateActivity[],
  onMutate?: (next: EstimateActivity[]) => void,
) {
  const [activities, setActivities] = useState<EstimateActivity[]>(
    () => initialActivities ?? [],
  );
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const jobIdRef = useRef(jobId);
  const activitiesRef = useRef(activities);
  const onMutateRef = useRef(onMutate);
  const fingerprint = useMemo(
    () => activitiesFingerprint(initialActivities),
    [initialActivities],
  );

  activitiesRef.current = activities;
  onMutateRef.current = onMutate;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (jobId !== jobIdRef.current) {
      jobIdRef.current = jobId;
      setActivities(initialActivities ?? []);
    }
  }, [jobId, initialActivities]);

  useEffect(() => {
    if (!enabled) return;
    if (initialActivities === undefined) return;
    setActivities(initialActivities);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fingerprint gates sync
  }, [enabled, fingerprint]);

  const publish = useCallback((next: EstimateActivity[]) => {
    activitiesRef.current = next;
    setActivities(next);
    queueMicrotask(() => {
      if (!mountedRef.current) return;
      onMutateRef.current?.(next);
    });
  }, []);

  const addActivity = useCallback(
    async (title: string, description: string) => {
      if (!jobId || !enabled) return null;
      setSaving(true);
      try {
        const created = await createJobActivity(jobId, {
          title: title.trim(),
          description: description.trim(),
        });
        if (created && mountedRef.current) {
          publish([
            created,
            ...activitiesRef.current.filter((item) => item.id !== created.id),
          ]);
        }
        toast.success("Activity posted.");
        return created;
      } catch (error) {
        toast.error(extractErrorMessage(error) || "Failed to post activity.");
        throw error;
      } finally {
        if (mountedRef.current) {
          setSaving(false);
        }
      }
    },
    [jobId, enabled, publish],
  );

  const updateActivity = useCallback(
    async (activityId: string, title: string, description: string) => {
      if (!jobId || !activityId || !enabled) return null;
      setSaving(true);
      try {
        const updated = await updateJobActivity(jobId, activityId, {
          title: title.trim(),
          description: description.trim(),
        });
        if (updated && mountedRef.current) {
          publish(
            activitiesRef.current.map((item) =>
              item.id === activityId ? updated : item,
            ),
          );
        }
        toast.success("Activity updated.");
        return updated;
      } catch (error) {
        toast.error(extractErrorMessage(error) || "Failed to update activity.");
        throw error;
      } finally {
        if (mountedRef.current) {
          setSaving(false);
        }
      }
    },
    [jobId, enabled, publish],
  );

  const deleteActivity = useCallback(
    async (activityId: string) => {
      if (!jobId || !activityId || !enabled) return false;
      setDeletingId(activityId);
      try {
        await deleteJobActivity(jobId, activityId);
        if (mountedRef.current) {
          publish(activitiesRef.current.filter((item) => item.id !== activityId));
        }
        toast.success("Activity deleted.");
        return true;
      } catch (error) {
        toast.error(extractErrorMessage(error) || "Failed to delete activity.");
        throw error;
      } finally {
        if (mountedRef.current) {
          setDeletingId(null);
        }
      }
    },
    [jobId, enabled, publish],
  );

  return {
    activities,
    saving,
    deletingId,
    addActivity,
    updateActivity,
    deleteActivity,
  };
}
