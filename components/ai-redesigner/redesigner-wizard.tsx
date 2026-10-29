"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  RefreshCw,
  Sparkles,
  Upload,
  WandSparkles,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CenteredSpinner } from "@/components/ui/spinner";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import {
  FINISH_CATEGORIES,
  ROOM_PHOTO_MAX_BYTES,
  ROOM_PHOTO_TYPES,
  getRedesign,
  startRedesign,
  uploadRoomPhoto,
  type FinishCategory,
  type FinishPicks,
  type RedesignContact,
  type RedesignGeneration,
  type RedesignStyle,
  type RoomType,
} from "@/lib/api/ai-redesigner-client";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";
import { selectAuthUser } from "@/store/authSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchRedesignCatalog,
  selectRedesignCatalog,
  selectRedesignCatalogStatus,
} from "@/store/aiRedesignerSlice";
import { BeforeAfterSlider } from "./before-after-slider";
import { SwatchDot } from "./finish-swatch";
import {
  DetailsStep,
  FinishesStep,
  PhotoStep,
  StyleStep,
  type FinishPreset,
  type SummaryRow,
} from "./redesigner-steps";

const STEPS = ["Photo", "Style", "Finishes", "Details"] as const;
const POLL_MS = 3000;
/** Give up waiting after this (the server also marks stuck runs as failed). */
const MAX_WAIT_MS = 6 * 60_000;
/** Typical run time — drives the progress bar (it eases toward 95% and waits there). */
const EXPECTED_MS = 55_000;
const PROGRESS_LINES = [
  "Reading your room's layout",
  "Keeping walls, windows and fixtures in place",
  "Fitting your new cabinets",
  "Setting the countertops",
  "Laying the backsplash",
  "Adding hardware and final lighting",
];
const PHOTO_TAGS = ["Wide shot", "Good light", "Whole room"];

type ContactErrors = Partial<Record<keyof RedesignContact | "consent", string>>;

function emptyPicks(): FinishPicks {
  return Object.fromEntries(FINISH_CATEGORIES.map((key) => [key, { style: null, color: null }])) as FinishPicks;
}

function picksFromStyle(style: RedesignStyle | undefined): FinishPicks {
  const picks = emptyPicks();
  if (!style) return picks;
  for (const key of FINISH_CATEGORIES) {
    picks[key] = { style: style.defaults?.[key]?.style || null, color: style.defaults?.[key]?.color || null };
  }
  return picks;
}

function validateContact(contact: RedesignContact, consent: boolean): ContactErrors {
  const errors: ContactErrors = {};
  if (contact.name.trim().length < 2) errors.name = "Please enter your name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact.email.trim())) errors.email = "Please enter a valid email.";
  if (!/^\d{5}(-\d{4})?$/.test(contact.zip.trim())) errors.zip = "Please enter a 5-digit ZIP code.";
  if (contact.phone.trim() && !/^[0-9+().\s-]{7,20}$/.test(contact.phone.trim())) errors.phone = "Please enter a valid phone number.";
  if (!consent) errors.consent = "Please agree so we can share your design.";
  return errors;
}

/** Saves the result; falls back to opening it when the browser blocks the download. */
async function downloadImage(url: string, name: string) {
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) throw new Error("download failed");
    const blobUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = name;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}

function GeneratingOverlay({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(startedAt);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 400);
    return () => window.clearInterval(timer);
  }, []);
  const elapsed = now - startedAt;
  const progress = Math.min(95, 95 * (1 - Math.exp(-elapsed / (EXPECTED_MS / 2.2))));
  const line = Math.min(PROGRESS_LINES.length - 1, Math.floor((elapsed / EXPECTED_MS) * PROGRESS_LINES.length));
  return (
    <div className="absolute inset-0 overflow-hidden" role="status" aria-live="polite">
      {/* Keyframes kept local so the global stylesheet is untouched. */}
      <style>{`@keyframes redesign-scan{0%{transform:translateY(-110%)}100%{transform:translateY(330%)}}`}</style>
      <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/45 to-black/65 backdrop-blur-[1.5px]" />
      {/* Scanning light sweeping over the photo */}
      <div className="absolute inset-x-0 h-1/3 animate-[redesign-scan_2.8s_ease-in-out_infinite] bg-gradient-to-b from-transparent via-white/25 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-5 text-white">
        <div className="flex items-center gap-2.5">
          <span className="relative flex size-9 items-center justify-center rounded-full bg-white/15 backdrop-blur">
            <span className="absolute inset-0 animate-ping rounded-full bg-white/20" />
            <WandSparkles className="relative size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Designing your room…</p>
            <p key={line} className="animate-in fade-in slide-in-from-bottom-1 text-xs text-white/80 duration-500">
              {PROGRESS_LINES[line]}
            </p>
          </div>
          <span className="ml-auto text-xs font-semibold tabular-nums">{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-white transition-[width] duration-500 ease-out" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}

export function RedesignerWizard() {
  const dispatch = useAppDispatch();
  const catalog = useAppSelector(selectRedesignCatalog);
  const status = useAppSelector(selectRedesignCatalogStatus);
  const authUser = useAppSelector(selectAuthUser);

  const [step, setStep] = useState(0);
  const [photo, setPhoto] = useState<{ url: string | null; preview: string | null }>({ url: null, preview: null });
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [roomType, setRoomType] = useState<RoomType>("kitchen");
  const [styleId, setStyleId] = useState("");
  const [picks, setPicks] = useState<FinishPicks>(emptyPicks);
  const [notes, setNotes] = useState("");
  const [contact, setContact] = useState<RedesignContact>(() => ({
    name: [authUser?.firstName, authUser?.lastName].filter(Boolean).join(" ") || String(authUser?.name || ""),
    email: authUser?.email || "",
    phone: authUser?.phone || "",
    zip: authUser?.zip || authUser?.location?.zip || "",
  }));
  const [consent, setConsent] = useState(false);
  const [contactErrors, setContactErrors] = useState<ContactErrors>({});
  const [history, setHistory] = useState<RedesignGeneration[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [running, setRunning] = useState<{ id: string; startedAt: number } | null>(null);
  const [starting, setStarting] = useState(false);
  const previewUrlRef = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void dispatch(fetchRedesignCatalog());
  }, [dispatch]);

  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    [],
  );

  const styles = useMemo(
    () => (catalog?.styles || []).filter((style) => style.roomType === roomType),
    [catalog, roomType],
  );
  const finishes = useMemo(
    () => (catalog?.finishes || []).filter((finish) => finish.roomType === roomType),
    [catalog, roomType],
  );
  const finishById = useMemo(() => new Map(finishes.map((finish) => [finish.id, finish])), [finishes]);
  const categories = useMemo(
    () =>
      catalog?.rooms?.find((room) => room.roomType === roomType)?.categories ||
      FINISH_CATEGORIES.map((key) => ({ key, label: key })),
    [catalog, roomType],
  );
  const style = styles.find((item) => item.id === styleId);
  const active = history.find((item) => item.id === activeId) || null;
  const roomWord = roomType === "kitchen" ? "kitchen" : "bathroom";

  /* ------------------------------------------------------------ photo */
  const pickPhoto = () => fileRef.current?.click();

  const handleFile = useCallback(async (file: File) => {
    setPhotoError(null);
    if (!ROOM_PHOTO_TYPES.includes(file.type)) {
      setPhotoError("Please choose a JPG, PNG or WebP photo.");
      return;
    }
    if (file.size > ROOM_PHOTO_MAX_BYTES) {
      setPhotoError("That photo is over 15 MB. Please choose a smaller one.");
      return;
    }
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const preview = URL.createObjectURL(file);
    previewUrlRef.current = preview;
    setPhoto({ url: null, preview });
    setActiveId(null);
    setUploading(true);
    try {
      const url = await uploadRoomPhoto(file);
      setPhoto({ url, preview });
    } catch (error) {
      setPhoto({ url: null, preview: null });
      setPhotoError(extractErrorMessage(error) || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }, []);

  /* ------------------------------------------------------------ picks */
  const chooseRoom = (room: RoomType) => {
    if (room === roomType) return;
    setRoomType(room);
    setStyleId("");
    setPicks(emptyPicks());
  };

  const chooseStyle = (next: RedesignStyle) => {
    setStyleId(next.id);
    setPicks(picksFromStyle(next));
  };

  const pick = (category: FinishCategory, kind: "style" | "color", id: string | null) => {
    setPicks((prev) => ({ ...prev, [category]: { ...prev[category], [kind]: id } }));
  };

  const surprise = () => {
    const random = <T,>(items: T[]) => (items.length ? items[Math.floor(Math.random() * items.length)] : undefined);
    const next = emptyPicks();
    for (const key of FINISH_CATEGORIES) {
      next[key] = {
        style: random(finishes.filter((f) => f.category === key && f.kind === "style"))?.id || null,
        color: random(finishes.filter((f) => f.category === key && f.kind === "color"))?.id || null,
      };
    }
    setPicks(next);
  };

  /** Palettes = the other styles' starting finishes, so customers can mix a look quickly. */
  const presets: FinishPreset[] = useMemo(
    () =>
      styles
        .filter((item) => item.id !== styleId)
        .map((item) => {
          const presetPicks = picksFromStyle(item);
          const dots = (["cabinets", "countertops", "hardware"] as FinishCategory[])
            .map((key) => finishById.get(presetPicks[key].color || "") || finishById.get(presetPicks[key].style || ""))
            .filter((finish): finish is NonNullable<typeof finish> => Boolean(finish));
          return { id: item.id, name: `${item.name} palette`, picks: presetPicks, dots };
        })
        .filter((preset) => preset.dots.length)
        .slice(0, 3),
    [styles, styleId, finishById],
  );

  /** The finish that best represents a category (colour first, then shape). */
  const mainFinish = (key: FinishCategory) =>
    finishById.get(picks[key].color || "") || finishById.get(picks[key].style || "") || null;
  const patternFor = (key: FinishCategory) => finishById.get(picks[key].style || "")?.pattern;

  const designChips = [
    ...(style ? [{ key: "style", label: style.name, image: style.image, color: style.swatches[0] }] : []),
    ...FINISH_CATEGORIES.map((key) => ({ key, finish: mainFinish(key) })).filter((item) => item.finish),
  ];

  const summary: SummaryRow[] = [
    { label: "Style", value: style ? `${style.name} ${roomWord}` : "—", image: style?.image || undefined },
    ...categories.map(({ key, label }) => {
      const names = [finishById.get(picks[key].style || "")?.name, finishById.get(picks[key].color || "")?.name].filter(Boolean);
      return { label, value: names.join(" · ") || "Keep existing", swatch: mainFinish(key) };
    }),
  ];

  /* ------------------------------------------------------------ generation */
  const create = async () => {
    if (!photo.url) return setStep(0);
    if (!styleId) return setStep(1);
    const errors = validateContact(contact, consent);
    setContactErrors(errors);
    if (Object.keys(errors).length) return;
    setStarting(true);
    try {
      const run = await startRedesign({
        roomType,
        styleId,
        finishes: picks,
        notes: notes.trim(),
        sourceImage: photo.url,
        contact: {
          name: contact.name.trim(),
          email: contact.email.trim(),
          phone: contact.phone.trim(),
          zip: contact.zip.trim(),
        },
        consent,
      });
      setHistory((prev) => [run, ...prev]);
      setActiveId(run.id);
      setRunning({ id: run.id, startedAt: Date.now() });
    } catch (error) {
      toast.error(extractErrorMessage(error) || "Could not start your design. Please try again.");
    } finally {
      setStarting(false);
    }
  };

  // Poll the running design until it finishes.
  const runningId = running?.id;
  useEffect(() => {
    if (!runningId) return;
    let cancelled = false;
    let timer: number | undefined;
    const startedAt = Date.now();

    const finish = (run: RedesignGeneration | null, message?: string) => {
      if (cancelled) return;
      if (run) setHistory((prev) => prev.map((item) => (item.id === run.id ? run : item)));
      if (message) toast.error(message);
      else toast.success("Your new room is ready!");
      setRunning(null);
    };

    const tick = async () => {
      try {
        const run = await getRedesign(runningId);
        if (cancelled) return;
        if (run.status === "done") return finish(run);
        if (run.status === "failed") return finish(run, run.error || "We couldn't create this design. Please try again.");
      } catch {
        // Network blip: keep polling until the time limit.
      }
      if (Date.now() - startedAt > MAX_WAIT_MS) {
        finish(null, "This is taking longer than expected. Please try again.");
        return;
      }
      timer = window.setTimeout(tick, POLL_MS);
    };
    timer = window.setTimeout(tick, POLL_MS);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [runningId]);

  const resetPhoto = () => {
    setPhoto({ url: null, preview: null });
    setActiveId(null);
    setStep(0);
  };

  /* ------------------------------------------------------------ render */
  if (status === "loading") return <CenteredSpinner />;
  if (status === "failed" || !catalog?.enabled) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-3xl border border-input bg-card px-6 py-12 text-center">
        <Sparkles className="size-8 text-primary" aria-hidden="true" />
        <h1 className="text-2xl font-semibold">The AI designer is coming soon</h1>
        <p className="text-sm text-muted-foreground">
          {status === "failed"
            ? "We couldn't load the designer right now. Please try again in a moment."
            : "We're putting the finishing touches on it. In the meantime, our pros can help you plan your remodel."}
        </p>
        <Button asChild>
          <Link href="/get-a-quote">Get a free quote</Link>
        </Button>
      </div>
    );
  }

  const busy = starting || Boolean(running);
  const done = active?.status === "done" && Boolean(active.resultImage);
  const shownPhoto = active?.sourceImage || photo.preview || photo.url;
  const reachable = (index: number) =>
    !busy && (index === 0 || (index === 1 && Boolean(photo.url)) || (index >= 2 && Boolean(photo.url && styleId)));
  const canNext = [Boolean(photo.url) && !uploading, Boolean(styleId), true][step] ?? false;
  const nextLabel = ["Next: Style", "Next: Finishes", "Next: Details"][step];
  const stageLabel = running
    ? "Designing…"
    : done && active
      ? `Your new ${active.style} ${active.roomType}`
      : shownPhoto
        ? "Your photo"
        : "No photo yet";

  return (
    <div className="flex flex-col gap-6">
      <input
        ref={fileRef}
        type="file"
        accept={ROOM_PHOTO_TYPES.join(",")}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
          event.target.value = "";
        }}
      />

      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="size-5" aria-hidden="true" />
            </span>
            <div className="leading-tight">
              <p className="text-[15px] font-semibold">{siteConfig.name}</p>
              <p className="text-[13px] text-muted-foreground">AI design studio</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3.5 py-1.5 text-[13px] font-semibold text-primary">
            <Zap className="size-3.5" aria-hidden="true" />
            Free · about a minute
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-semibold tracking-tight md:text-[2.6rem] md:leading-[1.1]">
            {catalog.section?.title || "See your kitchen or bathroom, redesigned"}
          </h1>
          <p className="max-w-3xl text-[15px] text-muted-foreground md:text-base">{catalog.section?.subtitle}</p>
        </div>
      </div>

      {/* Desktop: one fixed-height card; the photo fits inside and each step scrolls in its own panel. */}
      <div className="grid overflow-hidden rounded-[28px] border border-input bg-card shadow-[0_30px_70px_-50px_rgba(0,0,0,0.45)] lg:h-[min(48rem,calc(100dvh-6rem))] lg:grid-cols-[minmax(0,1.5fr)_minmax(24rem,1fr)] lg:grid-rows-[minmax(0,1fr)]">
        {/* Preview */}
        <div className="flex min-w-0 flex-col gap-4 bg-muted/40 bg-[radial-gradient(circle,rgba(0,0,0,0.07)_1px,transparent_1.2px)] [background-size:18px_18px] p-4 md:p-5 lg:min-h-0 lg:overflow-y-auto lg:border-r">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-card px-3.5 py-1.5 text-[13px] font-medium shadow-sm capitalize">
              <span className={cn("size-1.5 rounded-full", running ? "animate-pulse bg-primary" : done ? "bg-emerald-500" : "bg-muted-foreground/60")} />
              {stageLabel}
            </span>
            <div className="flex items-center gap-2">
              {done && active ? (
                <button
                  type="button"
                  onClick={() => void downloadImage(active.resultImage, `redesign-${active.id.slice(0, 8)}.jpg`)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-card px-3.5 py-1.5 text-[13px] font-medium shadow-sm transition-colors hover:bg-muted"
                >
                  <Download className="size-3.5" aria-hidden="true" />
                  Download
                </button>
              ) : null}
              {shownPhoto ? (
                <button
                  type="button"
                  onClick={resetPhoto}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-full bg-card px-3.5 py-1.5 text-[13px] font-medium shadow-sm transition-colors hover:bg-muted disabled:opacity-50"
                >
                  <RefreshCw className="size-3.5" aria-hidden="true" />
                  New photo
                </button>
              ) : null}
            </div>
          </div>

          {/* Stage */}
          <div className="relative aspect-[4/3] w-full lg:aspect-auto lg:min-h-[30rem] lg:flex-1">
            {shownPhoto ? (
              // Photo / result fill the whole stage width (cropped to fit) so the design reads big.
              <div className="absolute inset-0">
                <div className="relative size-full overflow-hidden rounded-2xl shadow-[0_24px_50px_-28px_rgba(0,0,0,0.55)]">
                  {done && active ? (
                    <BeforeAfterSlider
                      key={active.id}
                      before={active.sourceImage}
                      after={active.resultImage}
                      alt={`${active.style} ${active.roomType}`}
                      className="animate-in fade-in size-full duration-700"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element -- the customer's own photo (blob or our storage)
                    <img
                      src={shownPhoto}
                      alt="Your room"
                      className="block size-full object-cover"
                    />
                  )}
                  {running ? <GeneratingOverlay startedAt={running.startedAt} /> : null}
                  {uploading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/35 text-white backdrop-blur-[1px]">
                      <span className="size-8 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      <span className="text-xs font-medium">Uploading…</span>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={pickPhoto}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragOver(false);
                  const file = event.dataTransfer.files?.[0];
                  if (file) void handleFile(file);
                }}
                className={cn(
                  "absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 text-center transition-colors",
                  dragOver ? "border-primary bg-primary/[0.06]" : "border-input bg-card/60 hover:border-primary/40",
                )}
              >
                <span className="flex size-20 items-center justify-center rounded-full bg-primary/[0.07]">
                  <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Upload className="size-5" aria-hidden="true" />
                  </span>
                </span>
                <span className="text-lg font-semibold">Upload a photo of your {roomWord}</span>
                <span className="text-sm text-muted-foreground">Drag it here, or tap to take or choose one</span>
                <span className="mt-1 flex flex-wrap justify-center gap-2">
                  {PHOTO_TAGS.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 rounded-full border border-input bg-card px-2.5 py-1 text-xs text-muted-foreground">
                      <Check className="size-3 text-emerald-600" aria-hidden="true" />
                      {tag}
                    </span>
                  ))}
                </span>
              </button>
            )}
          </div>

          {/* Your design */}
          <div className="flex items-center gap-3 rounded-2xl bg-card px-4 py-2.5 shadow-sm">
            <span className="shrink-0 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Your design</span>
            <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto py-0.5 [scrollbar-width:none]">
              {designChips.length ? (
                designChips.map((chip) => (
                  <span key={chip.key} className="inline-flex shrink-0 items-center gap-2 rounded-full border border-input bg-card py-1 pr-3 pl-1 text-[13px] font-medium">
                    {"finish" in chip && chip.finish ? (
                      <SwatchDot finish={chip.finish} fallbackPattern={patternFor(chip.key as FinishCategory)} className="size-6" />
                    ) : "image" in chip && chip.image ? (
                      // eslint-disable-next-line @next/next/no-img-element -- style preview thumbnail
                      <img src={chip.image} alt="" className="size-6 rounded-full object-cover" />
                    ) : (
                      <span className="size-6 rounded-full border border-black/10" style={{ background: "color" in chip ? chip.color : undefined }} />
                    )}
                    {"finish" in chip && chip.finish ? chip.finish.name : "label" in chip ? chip.label : ""}
                  </span>
                ))
              ) : (
                <span className="text-[13px] text-muted-foreground">Your picks show up here</span>
              )}
            </div>
          </div>

          {history.length ? (
            <div className="flex gap-2.5 overflow-x-auto pb-0.5">
              {history.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveId(item.id)}
                  aria-label={`Show ${item.style} design`}
                  className={cn(
                    "relative h-[58px] w-20 shrink-0 overflow-hidden rounded-xl border-2 bg-muted transition-colors",
                    item.id === activeId ? "border-primary" : "border-transparent hover:border-primary/40",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- design thumbnail */}
                  <img src={item.resultImage || item.sourceImage} alt="" className={cn("size-full object-cover", !item.resultImage && "opacity-50")} />
                  {item.status === "failed" ? (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-[10px] font-semibold text-white">Failed</span>
                  ) : !item.resultImage ? (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="size-4 animate-spin rounded-full border-2 border-white/50 border-t-white" />
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}

          <div className="mt-auto flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">Love it? {siteConfig.name} pros can build it.</p>
              <p className="text-[13px] text-muted-foreground">Bring this design to a free consultation, or keep trying other looks.</p>
            </div>
            <Button asChild className="h-10 shrink-0 rounded-full px-5">
              <Link href="/get-a-quote">
                Book a free consultation
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Steps */}
        <div className="flex min-w-0 flex-col p-5 md:p-7 lg:min-h-0">
          <ol className="mb-6 grid shrink-0 grid-cols-4 gap-3">
            {STEPS.map((label, index) => {
              const isDone = index < step;
              const isCurrent = index === step;
              return (
                <li key={label}>
                  <button
                    type="button"
                    onClick={() => reachable(index) && setStep(index)}
                    disabled={!reachable(index)}
                    aria-current={isCurrent ? "step" : undefined}
                    className="flex w-full flex-col items-center gap-1.5 disabled:cursor-not-allowed"
                  >
                    <span
                      className={cn(
                        "flex size-7 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                        isDone || isCurrent ? "bg-primary text-primary-foreground" : "border border-input text-muted-foreground",
                      )}
                    >
                      {isDone ? <Check className="size-3.5" aria-hidden="true" /> : index + 1}
                    </span>
                    <span className={cn("text-[13px]", isCurrent ? "font-semibold text-foreground" : "text-muted-foreground")}>{label}</span>
                    <span
                      className={cn(
                        "h-[3px] w-full rounded-full transition-colors",
                        isCurrent ? "bg-primary" : isDone ? "bg-primary/35" : "bg-muted",
                      )}
                    />
                  </button>
                </li>
              );
            })}
          </ol>

          <div key={step} className="animate-in fade-in slide-in-from-right-2 flex-1 duration-300 lg:-mx-2 lg:min-h-0 lg:overflow-y-auto lg:px-2 lg:pb-2">
            {step === 0 ? (
              <PhotoStep
                roomType={roomType}
                onRoomType={chooseRoom}
                photo={photo.preview || photo.url}
                uploading={uploading}
                error={photoError}
                onPick={pickPhoto}
              />
            ) : null}
            {step === 1 ? <StyleStep roomType={roomType} styles={styles} styleId={styleId} onStyle={chooseStyle} /> : null}
            {step === 2 ? (
              <FinishesStep
                styleName={style?.name || "selected"}
                categories={categories}
                finishes={finishes}
                picks={picks}
                presets={presets}
                onPick={pick}
                onPreset={(preset) => setPicks(preset.picks)}
                onSurprise={surprise}
                notes={notes}
                onNotes={setNotes}
              />
            ) : null}
            {step === 3 ? (
              <DetailsStep
                roomType={roomType}
                summary={summary}
                onEdit={() => setStep(2)}
                contact={contact}
                onContact={(patch) => {
                  setContact((prev) => ({ ...prev, ...patch }));
                  setContactErrors((prev) => {
                    const next = { ...prev };
                    for (const key of Object.keys(patch)) delete next[key as keyof RedesignContact];
                    return next;
                  });
                }}
                consent={consent}
                onConsent={(value) => {
                  setConsent(value);
                  setContactErrors((prev) => ({ ...prev, consent: undefined }));
                }}
                errors={contactErrors}
              />
            ) : null}
          </div>

          <div className="sticky bottom-0 mt-4 flex shrink-0 items-center gap-3 bg-card pt-4 lg:border-t lg:border-border-soft">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => setStep((value) => Math.max(0, value - 1))}
                disabled={busy}
                className="inline-flex h-12 items-center gap-1.5 rounded-full border border-input px-5 text-sm font-semibold transition-colors hover:bg-muted disabled:opacity-50"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                Back
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => (step < 3 ? setStep((value) => value + 1) : void create())}
              disabled={step < 3 ? !canNext : busy || uploading}
              className="group inline-flex h-12 flex-1 items-center justify-between gap-3 rounded-full bg-primary pr-1.5 pl-6 text-[15px] font-semibold text-primary-foreground shadow-[0_12px_24px_-14px_rgba(0,63,125,0.9)] transition-[opacity,transform] hover:opacity-95 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span>
                {step < 3 ? nextLabel : running ? "Designing…" : done ? `Design my ${roomWord} again` : `Design my ${roomWord}`}
              </span>
              <span className="flex size-9 items-center justify-center rounded-full bg-white/15 transition-transform group-hover:translate-x-0.5">
                {step < 3 ? (
                  <ArrowRight className="size-4" aria-hidden="true" />
                ) : busy ? (
                  <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                ) : (
                  <Sparkles className="size-4" aria-hidden="true" />
                )}
              </span>
            </button>
          </div>
          {step === 3 && done ? (
            <button type="button" onClick={() => setStep(2)} className="mt-3 text-center text-sm font-semibold text-primary hover:underline">
              Try other finishes
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
