/** Provisioning state of the provider's virtual (Twilio) AI phone number. */
export type AiPhoneNumberStatus = "active" | "pending" | "unassigned";

/** Cartesia Sonic voice keys; the backend maps each key to a Cartesia voice id. */
export type AiVoiceId = "skylar" | "daniel" | "gemma" | "parker";

export type AiVoiceOption = {
  id: AiVoiceId;
  label: string;
  gender: "female" | "male";
  tone: string;
  /** Avatar tint classes (light + dark). */
  accentClassName: string;
};

/** Everything the provider can configure for the AI voice receptionist. */
export type AiCallingSettings = {
  enabled: boolean;
  /** Read-only: assigned by the platform (E.164, e.g. +15125550123). */
  aiPhoneNumber: string | null;
  aiPhoneNumberStatus: AiPhoneNumberStatus;
  /** Why the number is still pending, from the backend. */
  provisioningNote: string;
  /** Where the AI transfers calls when a caller asks for a human (E.164). */
  escalationNumber: string;
  greeting: string;
  voiceId: AiVoiceId;
};

/** Fields the provider is allowed to change. */
export type AiCallingSettingsUpdate = Pick<
  AiCallingSettings,
  "enabled" | "escalationNumber" | "greeting" | "voiceId"
>;

/**
 * Data source for the settings UI. Swap it per project; the default talks to
 * `provider/ai-calling` on this app's API.
 */
export type AiCallingAdapter = {
  load: () => Promise<AiCallingSettings>;
  save: (update: AiCallingSettingsUpdate) => Promise<AiCallingSettings>;
};
