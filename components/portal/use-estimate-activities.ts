"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { extractErrorMessage } from "@/components/api/apiFuntions";
import {
  createEstimateActivity,
  deleteEstimateActivity,
  listEstimateActivities,
  updateEstimateActivity,
} from "@/lib/api/crm-client";
import type { EstimateActivity } from "@/lib/types";

export function useEstimateActivities(
  estimateId?: string,
  enabled = true,
  initialActivities?: EstimateActivity[],
) {
  const [activities, setActivities] = useState<EstimateActivity[]>(() => initialActivities ?? []);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Synchronize when initialActivities changes
  useEffect(() => {
    if (initialActivities && initialActivities.length > 0) {
      setActivities((current) => (current.length === 0 ? initialActivities : current));
    }
  }, [initialActivities]);

  const refresh = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!estimateId || !enabled) return;
      if (!options?.silent) setLoading(true);
      try {
        const list = await listEstimateActivities(estimateId, { silent: options?.silent ?? true });
        if (mountedRef.current) {
          setActivities(list);
        }
      } catch (error) {
        if (!options?.silent) {
          toast.error(extractErrorMessage(error) || "Could not load estimate activities.");
        }
      } finally {
        if (mountedRef.current && !options?.silent) {
          setLoading(false);
        }
      }
    },
    [estimateId, enabled],
  );

  useEffect(() => {
    if (estimateId && enabled) {
      void refresh({ silent: Boolean(initialActivities && initialActivities.length > 0) });
    } else {
      setActivities([]);
    }
  }, [estimateId, enabled, refresh, initialActivities]);

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
          setActivities((prev) => [created, ...prev.filter((item) => item.id !== created.id)]);
        } else {
          await refresh({ silent: true });
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
    [estimateId, refresh],
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
          setActivities((prev) =>
            prev.map((item) => (item.id === activityId ? updated : item)),
          );
        } else {
          await refresh({ silent: true });
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
    [estimateId, refresh],
  );

  const deleteActivity = useCallback(
    async (activityId: string) => {
      if (!estimateId || !activityId) return false;
      setDeletingId(activityId);
      try {
        await deleteEstimateActivity(estimateId, activityId);
        if (mountedRef.current) {
          setActivities((prev) => prev.filter((item) => item.id !== activityId));
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
    [estimateId],
  );

  return {
    activities,
    loading,
    saving,
    deletingId,
    refresh,
    addActivity,
    updateActivity,
    deleteActivity,
  };
}
