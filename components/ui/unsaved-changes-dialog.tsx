"use client";

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type UnsavedChangesDialogProps = {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  description?: string;
  saveLabel?: string;
  discardLabel?: string;
  cancelLabel?: string;
  onSave?: () => void | Promise<void>;
  onDiscard?: () => void;
  onCancel?: () => void;
  saving?: boolean;
};

export function UnsavedChangesDialog({
  open,
  onOpenChange,
  title = "Unsaved changes",
  description = "You have unsaved changes. Do you want to save them before leaving, or discard them?",
  saveLabel = "Save changes",
  discardLabel = "Discard & leave",
  cancelLabel = "Stay here",
  onSave,
  onDiscard,
  onCancel,
  saving = false,
}: UnsavedChangesDialogProps) {
  const [internalSaving, setInternalSaving] = useState(false);
  const isSaving = saving || internalSaving;

  const handleSave = async () => {
    if (!onSave || isSaving) return;
    try {
      setInternalSaving(true);
      await onSave();
      onOpenChange?.(false);
    } catch (err) {
      console.error(err);
    } finally {
      setInternalSaving(false);
    }
  };

  const handleDiscard = () => {
    if (isSaving) return;
    onDiscard?.();
    onOpenChange?.(false);
  };

  const handleCancel = () => {
    if (isSaving) return;
    onCancel?.();
    onOpenChange?.(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isSaving) return;
        if (!next) handleCancel();
        else onOpenChange?.(true);
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={!isSaving}
        onPointerDownOutside={(e) => {
          if (isSaving) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (isSaving) e.preventDefault();
        }}
      >
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <AlertTriangle className="size-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted-foreground">
                {description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          {!isSaving && (
            <>
              <Button
                type="button"
                variant="ghost"
                disabled={isSaving}
                onClick={handleCancel}
              >
                {cancelLabel}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isSaving}
                onClick={handleDiscard}
              >
                {discardLabel}
              </Button>
            </>
          )}
          <Button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className="min-w-[120px]"
          >
            {isSaving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Saving…</span>
              </>
            ) : (
              saveLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
