"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type MouseEvent,
  type ReactNode,
} from "react";
import { MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Page-header actions on phones (< 640 px) — one menu instead of a wrapped row of buttons:
 *  - the header has a "More actions" dropdown → only that button shows; the other header buttons
 *    are listed at the top of its menu (`MoreActionsMenuContent`);
 *  - no dropdown, 2+ actions → a "⋮" button opens the actions as a plain menu list;
 *  - a single action → shown as-is.
 * Tablet / desktop render the row exactly as before (`className`).
 *
 * The real buttons are rendered ONCE and only hidden with CSS, and menu items just click them, so
 * links, dialog triggers, disabled states and their dialogs keep working unchanged.
 */

type MobileAction = { key: string; label: string; disabled: boolean; run: () => void };
type Mode = "inline" | "kebab" | "more";

const PHONE_QUERY = "(max-width: 639.98px)";
const ActionsContext = createContext<MobileAction[]>([]);

function subscribePhone(callback: () => void) {
  const query = window.matchMedia(PHONE_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function useIsPhone() {
  return useSyncExternalStore(subscribePhone, () => window.matchMedia(PHONE_QUERY).matches, () => false);
}

const isMenuTrigger = (el: Element) => el.matches("[aria-haspopup=menu], [aria-haspopup=listbox]");

export function MobileActionsMenu({
  children,
  className,
  collapsedRootClassName,
  label = "Actions",
}: {
  children: ReactNode;
  /** Classes of the actions row (sm+ and phones with a single action). */
  className?: string;
  /** Extra classes on the wrapper when the ⋮ button is used (e.g. pin it to a card corner). */
  collapsedRootClassName?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("inline");
  const [items, setItems] = useState<MobileAction[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Read the rendered controls (actions are often wrapped in fragments / divs) and keep in sync.
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const read = () => {
      const all = Array.from(panel.querySelectorAll<HTMLElement>("button, a[href]"));
      // "Close" (close the record) isn't offered on phones — hidden there by CSS (data-mobile-hide).
      for (const el of all) {
        const isClose = el.textContent?.trim() === "Close";
        if (isClose && !el.hasAttribute("data-mobile-hide")) el.setAttribute("data-mobile-hide", "");
      }
      const controls = all.filter((el) => !el.hasAttribute("data-mobile-hide"));
      const plain = controls.filter((el) => !isMenuTrigger(el));
      const hasMore = controls.some(isMenuTrigger);
      setMode(hasMore && plain.length ? "more" : controls.length > 1 ? "kebab" : "inline");
      setItems((previous) => {
        const next = plain.map((el, index) => ({
          key: `${index}-${el.textContent?.trim() ?? ""}`,
          label: el.textContent?.trim() || el.getAttribute("aria-label") || "Action",
          disabled: el.matches(":disabled, [aria-disabled=true]"),
          run: () => el.click(),
        }));
        const same =
          previous.length === next.length &&
          previous.every((item, index) => item.key === next[index].key && item.disabled === next[index].disabled);
        return same ? previous : next;
      });
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(panel, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["disabled", "aria-disabled"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (rootRef.current?.contains(target)) return;
      // Menus / dialogs opened from an action live in portals — not an "outside" click.
      if (target?.closest?.("[data-radix-popper-content-wrapper], [role=dialog], [role=alertdialog], [role=menu]")) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function onPanelClick(event: MouseEvent<HTMLDivElement>) {
    if (!open) return;
    const control = (event.target as Element).closest("button, a");
    if (!control || (control as HTMLButtonElement).disabled || isMenuTrigger(control)) return;
    setOpen(false);
  }

  const kebab = mode === "kebab";
  return (
    <ActionsContext.Provider value={mode === "more" ? items : []}>
      <div
        ref={rootRef}
        data-collapsed-actions={kebab ? "" : undefined}
        className={cn("relative print:hidden", kebab && collapsedRootClassName)}
      >
        {kebab ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 sm:hidden"
            aria-label={label}
            title={label}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            <MoreVertical className="size-4" aria-hidden />
          </Button>
        ) : null}
        <div
          ref={panelRef}
          onClick={onPanelClick}
          data-mobile-actions={mode}
          className={cn(
            className,
            kebab &&
              "max-sm:absolute max-sm:top-full max-sm:right-0 max-sm:z-40 max-sm:mt-1.5 max-sm:w-60 max-sm:max-w-[calc(100vw-2rem)] max-sm:flex-col max-sm:flex-nowrap max-sm:items-stretch max-sm:justify-start max-sm:gap-0.5 max-sm:rounded-lg max-sm:border max-sm:border-border max-sm:bg-popover max-sm:p-1 max-sm:shadow-lg",
            kebab && !open && "max-sm:hidden",
          )}
        >
          {children}
        </div>
      </div>
    </ActionsContext.Provider>
  );
}

/**
 * Drop-in for `DropdownMenuContent` in a header "More actions" menu: on phones it lists the
 * header's other buttons first (they're hidden there by `MobileActionsMenu`), then the menu's own items.
 */
export function MoreActionsMenuContent({ children, ...props }: ComponentProps<typeof DropdownMenuContent>) {
  const items = useContext(ActionsContext);
  const phone = useIsPhone();
  const extra = phone ? items : [];
  return (
    <DropdownMenuContent {...props}>
      {extra.map((item) => (
        <DropdownMenuItem
          key={item.key}
          disabled={item.disabled}
          // Let the menu close first, then press the real (hidden) button / link.
          onSelect={() => window.setTimeout(item.run, 0)}
        >
          {item.label}
        </DropdownMenuItem>
      ))}
      {extra.length ? <DropdownMenuSeparator /> : null}
      {children}
    </DropdownMenuContent>
  );
}
