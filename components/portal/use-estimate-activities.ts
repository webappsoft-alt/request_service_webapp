"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { extractErrorMessage } from "@/components/api/apiFuntions";
import {
  createEstimateActivity,
  deleteEstimateActivity,
  updateEstimateActivity,
} from "@/lib/api/crm-client";
import type { EstimateActivity } from "@/lib/types";

function activitiesFingerprint(list?: EstimateActivity[]) {
  if (!list) return "";
  return list
    .map((item) => `${item.id}:${item.updatedAt || item.createdAt}:${item.title}`)
    .join("|");
}

export function useEstimateActivities(
  estimateId?: string,
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
  const estimateIdRef = useRef(estimateId);
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

  // Reset when navigating to a different estimate
  useEffect(() => {
    if (estimateId !== estimateIdRef.current) {
      estimateIdRef.current = estimateId;
      setActivities(initialActivities ?? []);
    }
  }, [estimateId, initialActivities]);

  // Sync from getEstimate / parent when the server payload identity changes.
  // Fingerprint avoids wiping local state on unrelated parent re-renders that
  // pass a new [] reference with the same contents.
  useEffect(() => {
    if (!enabled) return;
    if (initialActivities === undefined) return;
    setActivities(initialActivities);
    // Only re-sync when the activity payload identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fingerprint gates sync
  }, [enabled, fingerprint]);

  const publish = useCallback((next: EstimateActivity[]) => {
    activitiesRef.current = next;
    setActivities(next);
    // Defer parent/CRM updates so we never setState another component
    // during this component's state updater / render path.
    queueMicrotask(() => {
      if (!mountedRef.current) return;
      onMutateRef.current?.(next);
    });
  }, []);

  const addActivity = useCallback(
    async (title: string, description: string) => {
      if (!estimateId || !enabled) return null;
      setSaving(true);
      try {
        const created = await createEstimateActivity(estimateId, {
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
    [estimateId, enabled, publish],
  );

  const updateActivity = useCallback(
    async (activityId: string, title: string, description: string) => {
      if (!estimateId || !activityId || !enabled) return null;
      setSaving(true);
      try {
        const updated = await updateEstimateActivity(estimateId, activityId, {
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
    [estimateId, enabled, publish],
  );

  const deleteActivity = useCallback(
    async (activityId: string) => {
      if (!estimateId || !activityId || !enabled) return false;
      setDeletingId(activityId);
      try {
        await deleteEstimateActivity(estimateId, activityId);
        if (mountedRef.current) {
          publish(activitiesRef.current.filter((item) => item.id !== activityId));
        }
        toast.success("Activity deleted.");
        return true;
      } catch (error) {
        toast.error(extractErrorMessage(error) || "Failed to delete activity.");
        return false;
      } finally {
        if (mountedRef.current) {
          setDeletingId(null);
        }
      }
    },
    [estimateId, enabled, publish],
  );

  return {
    activities,
    loading: false,
    saving,
    deletingId,
    addActivity,
    updateActivity,
    deleteActivity,
  };
}
