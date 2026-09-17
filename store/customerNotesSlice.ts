/**
 * Customer Notes slice — thin module export for store registration.
 * Shared logic lives in `store/notes/createEntityNotesSlice.ts`.
 */
export {
  type CrmNote as CustomerNote,
  type NoteAttachment as CustomerNoteAttachment,
  type NoteCreateInput as CustomerNoteCreateInput,
  type NoteUpdateInput as CustomerNoteUpdateInput,
} from "@/store/notes/types";

import { customerNotesModule } from "@/store/notes/modules";

export const fetchCustomerNotes = customerNotesModule.fetchNotes;
export const createCustomerNote = customerNotesModule.createNote;
export const updateCustomerNote = customerNotesModule.updateNote;
export const deleteCustomerNote = customerNotesModule.deleteNote;

export const {
  setEntity: setCustomerNotesEntity,
  setSearch: setCustomerNotesSearch,
  setPage: setCustomerNotesPage,
  invalidateCache: invalidateCustomerNotesCache,
  clearError: clearCustomerNotesError,
  optimisticTogglePin: optimisticToggleNotePin,
} = customerNotesModule.actions;

export default customerNotesModule.reducer;
