"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import { providerAiCallingAdapter } from "./api";
import { DEFAULT_AI_CALLING_SETTINGS, GREETING_MAX_LENGTH } from "./constants";
import { isValidE164, normalizePhone } from "./phone";
import type { AiCallingAdapter, AiCallingSettings, AiCallingSettingsUpdate } from "./types";

export type AiCallingErrors = Partial<Record<keyof AiCallingSettingsUpdate, string>>;

function toUpdate(settings: AiCallingSettings): AiCallingSettingsUpdate {
  return {
    enabled: settings.enabled,
    escalationNumber: settings.escalationNumber,
    greeting: settings.greeting,
    voiceId: settings.voiceId,
  };
}

export function validateAiCalling(draft: AiCallingSettingsUpdate): AiCallingErrors {
  const errors: AiCallingErrors = {};
  const phone = normalizePhone(draft.escalationNumber);
  if (phone && !isValidE164(phone)) {
    errors.escalationNumber = "Enter a valid phone number, e.g. +1 512 555 0123.";
  } else if (draft.enabled && !phone) {
    errors.escalationNumber = "Add a forwarding number so callers can reach a person.";
  }
  const greeting = draft.greeting.trim();
  if (!greeting) errors.greeting = "Add a greeting for incoming callers.";
  else if (greeting.length > GREETING_MAX_LENGTH) {
    errors.greeting = `Keep the greeting under ${GREETING_MAX_LENGTH} characters.`;
  }
  return errors;
}

/** Loads the saved settings, keeps an editable draft, validates and saves it. */
export function useAiCallingSettings(adapter: AiCallingAdapter = providerAiCallingAdapter) {
  const [saved, setSaved] = useState<AiCallingSettings>(DEFAULT_AI_CALLING_SETTINGS);
  const [draft, setDraft] = useState<AiCallingSettingsUpdate>(toUpdate(DEFAULT_AI_CALLING_SETTINGS));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  // Bumped by reload() to refetch.
  const [loadKey, setLoadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    adapter
      .load()
      .then((next) => {
        if (cancelled) return;
        setSaved(next);
        setDraft(toUpdate(next));
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(extractErrorMessage(error) || "Could not load AI calling settings.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [adapter, loadKey]);

  const reload = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    setLoadKey((key) => key + 1);
  }, []);

  const errors = useMemo(() => validateAiCalling(draft), [draft]);
  const dirty = useMemo(() => {
    const base = toUpdate(saved);
    // `enabled` isn't counted: the master switch saves on its own.
    return (
      normalizePhone(base.escalationNumber) !== normalizePhone(draft.escalationNumber) ||
      base.greeting !== draft.greeting ||
      base.voiceId !== draft.voiceId
    );
  }, [draft, saved]);

  const update = useCallback(<K extends keyof AiCallingSettingsUpdate>(key: K, value: AiCallingSettingsUpdate[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  }, []);

  const reset = useCallback(() => {
    setDraft(toUpdate(saved));
    setShowErrors(false);
  }, [saved]);

  const persist = useCallback(
    async (values: AiCallingSettingsUpdate) => {
      setShowErrors(true);
      if (Object.keys(validateAiCalling(values)).length) return false;
      setSaving(true);
      try {
        const next = await adapter.save({
          ...values,
          escalationNumber: normalizePhone(values.escalationNumber),
          greeting: values.greeting.trim(),
        });
        setSaved(next);
        setDraft(toUpdate(next));
        setShowErrors(false);
        return true;
      } finally {
        setSaving(false);
      }
    },
    [adapter],
  );

  /** Saves the draft. Resolves false on validation errors; throws API errors. */
  const save = useCallback(() => persist(draft), [draft, persist]);

  /**
   * The master switch saves right away (with any other pending edits) so the number
   * is assigned immediately. Turning on without a forwarding number only flags the field.
   */
  const setEnabled = useCallback(
    async (enabled: boolean) => {
      const values = { ...draft, enabled };
      if (Object.keys(validateAiCalling(values)).length) {
        setShowErrors(true);
        return false;
      }
      setDraft(values);
      try {
        return await persist(values);
      } catch (error) {
        setDraft((current) => ({ ...current, enabled: !enabled }));
        throw error;
      }
    },
    [draft, persist],
  );

  return {
    saved,
    draft,
    errors: showErrors ? errors : ({} as AiCallingErrors),
    loading,
    loadError,
    saving,
    dirty,
    update,
    reset,
    save,
    setEnabled,
    reload,
  };
}
