"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/40 duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] supports-backdrop-filter:backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  onPointerDownOutside,
  onInteractOutside,
  onFocusOutside,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  function isPortaledSelectEvent(event: {
    target: EventTarget | null
    detail?: { originalEvent?: Event }
  }) {
    const original = event.detail?.originalEvent
    const fallback = event as { composedPath?: () => EventTarget[] }
    const path =
      original && typeof original.composedPath === "function"
        ? original.composedPath()
        : typeof fallback.composedPath === "function"
          ? fallback.composedPath()
          : []
    const matchesPortaledUi = (node: EventTarget) =>
      node instanceof Element &&
      Boolean(
        node.closest(
          "[data-paginated-entity-menu], .rs-phone-dropdown, .rs-phone-input .country-list, .rs-phone-input .flag-dropdown",
        ),
      )
    if (path.some(matchesPortaledUi)) {
      return true
    }
    const target = (original?.target ?? event.target) as EventTarget | null
    return Boolean(target && matchesPortaledUi(target))
  }

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-open:slide-in-from-bottom-4 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-closed:slide-out-to-bottom-2",
          className,
          // Shell wins over call-site max-h / overflow.
          "flex max-h-[min(90dvh,calc(100dvh-2rem))] flex-col gap-0 overflow-hidden p-0",
        )}
        {...props}
        onPointerDownOutside={(event) => {
          if (isPortaledSelectEvent(event)) {
            event.preventDefault()
            return
          }
          onPointerDownOutside?.(event)
        }}
        onInteractOutside={(event) => {
          if (isPortaledSelectEvent(event)) {
            event.preventDefault()
            return
          }
          onInteractOutside?.(event)
        }}
        onFocusOutside={(event) => {
          if (isPortaledSelectEvent(event)) {
            event.preventDefault()
            return
          }
          onFocusOutside?.(event)
        }}
      >
        <div
          data-slot="dialog-scroll"
          className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain"
        >
          <div className="flex min-h-full flex-col gap-4 px-4 pt-4 pb-0">
            {children}
          </div>
        </div>
        {showCloseButton && (
          <DialogPrimitive.Close data-slot="dialog-close" asChild>
            <Button
              variant="ghost"
              className="absolute top-2 right-2 z-20"
              size="icon-sm"
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </Button>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        "sticky top-0 z-10 -mx-4 -mt-4 shrink-0 space-y-2 border-b border-input bg-popover px-4 pt-4 pb-3 pr-12",
        className,
      )}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "sticky bottom-0 z-10 -mx-4 mt-auto flex shrink-0 flex-col-reverse gap-2 border-t bg-muted p-4 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-base leading-none font-medium",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
