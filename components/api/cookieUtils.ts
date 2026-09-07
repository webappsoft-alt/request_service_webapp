/**
 * @deprecated Prefer `@/components/api/apiFuntions` (`getAuthToken`, `getAuthUser`, `getPersistedAuth`).
 * Kept so older imports do not break during the Redux Persist migration.
 */
export {
  getAuthToken,
  getAuthUser,
  getPersistedAuth,
} from "./apiFuntions";

export type { AuthUser, AuthPayload } from "@/store/authSlice";
