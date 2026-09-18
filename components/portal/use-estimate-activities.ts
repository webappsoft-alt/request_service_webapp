"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { extractErrorMessage } from "@/components/api/apiFuntions";
import {
  createEstimateActivity,
  deleteEstimateActivity,
  updateEstimateActivity,
} from "@/lib/api/crm-client";
import type { EstimateActivity } from "@/lib/types";

export function useEstimateActivities(
  estimateId?: string,
  enabled = true,
  initialActivities?: EstimateActivity[],
  onMutate?: (next: EstimateActivity[]) => void,
) {
  const [activities, setActivities] = useState<EstimateActivity[]>(() => initialActivities ?? []);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Synchronize when estimate.activities from getEstimate API changes
  useEffect(() => {
    if (initialActivities) {
      setActivities(initialActivities);
    }
  }, [initialActivities]);

  const addActivity = useCallback(
    async (title: string, description: string) => {
      if (!estimateId) return null;
      setSaving(true);
      try {
        const created = await createEstimateActivity(estimateId, {
          title: title.trim(),
          description: description.trim(),
        });
        if (created && mountedRef.current) {
          setActivities((prev) => {
            const next = [created, ...prev.filter((item) => item.id !== created.id)];
            onMutate?.(next);
            return next;
          });
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
    [estimateId, onMutate],
  );

  const updateActivity = useCallback(
    async (activityId: string, title: string, description: string) => {
      if (!estimateId || !activityId) return null;
      setSaving(true);
      try {
        const updated = await updateEstimateActivity(estimateId, activityId, {
          title: title.trim(),
          description: description.trim(),
        });
        if (updated && mountedRef.current) {
          setActivities((prev) => {
            const next = prev.map((item) => (item.id === activityId ? updated : item));
            onMutate?.(next);
            return next;
          });
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
    [estimateId, onMutate],
  );

  const deleteActivity = useCallback(
    async (activityId: string) => {
      if (!estimateId || !activityId) return false;
      setDeletingId(activityId);
      try {
        await deleteEstimateActivity(estimateId, activityId);
        if (mountedRef.current) {
          setActivities((prev) => {
            const next = prev.filter((item) => item.id !== activityId);
            onMutate?.(next);
            return next;
          });
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
    [estimateId, onMutate],
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
