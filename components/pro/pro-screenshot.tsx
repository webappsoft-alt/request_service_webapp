import Image from "next/image";
import { cn } from "@/lib/utils";

export const PRO_SHOT_DIR = "/marketing/pro";

/** Desktop captures are 1440×900 @2x, exported at 1920×1200. */
export const DESKTOP_SHOT = { width: 1920, height: 1200 } as const;
/** Mobile captures are 390×844 @3x, exported at 780×1688. */
export const MOBILE_SHOT = { width: 780, height: 1688 } as const;

export function proShot(name: string) {
  return `${PRO_SHOT_DIR}/${name}.webp`;
}

type ProScreenshotProps = {
  /** File name under `public/marketing/pro`, without extension. */
  name: string;
  alt: string;
  /** Override the assumed 1920×1200 frame for captures with a different crop. */
  width?: number;
  height?: number;
  /** Optional mobile capture layered over the bottom-right corner. */
  mobileName?: string;
  mobileAlt?: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
  /** Show the browser chrome (traffic lights + URL bar). */
  chrome?: boolean;
  /** Address shown in the chrome bar. */
  url?: string;
};

/**
 * Real portal capture in a light browser frame — the only way product UI is
 * shown on the /pro landing page.
 */
export function ProScreenshot({
  name,
  alt,
  mobileName,
  mobileAlt,
  priority = false,
  sizes = "(min-width: 1280px) 60vw, 100vw",
  className,
  chrome = true,
  url = "app.requestservices.com/pro/dashboard",
  width = DESKTOP_SHOT.width,
  height = DESKTOP_SHOT.height,
}: ProScreenshotProps) {
  return (
    <div className={cn("relative", mobileName && "sm:pb-24 sm:pr-8", className)}>
      <div className="overflow-hidden rounded-xl border border-black/8 bg-card shadow-[0_30px_70px_-30px_rgba(2,16,36,0.45),0_8px_20px_-12px_rgba(2,16,36,0.25)] ring-1 ring-black/5">
        {chrome ? (
          <div className="flex items-center gap-3 border-b border-black/6 bg-[#f4f6f9] px-3.5 py-2">
            <span className="flex items-center gap-1.5" aria-hidden="true">
              <span className="size-2.5 rounded-full bg-[#ff5f57]" />
              <span className="size-2.5 rounded-full bg-[#febc2e]" />
              <span className="size-2.5 rounded-full bg-[#28c840]" />
            </span>
            <span className="mx-auto hidden h-6 w-full max-w-sm items-center justify-center truncate rounded-md bg-white px-3 font-mono text-[10px] text-muted-foreground ring-1 ring-black/6 sm:flex">
              {url}
            </span>
          </div>
        ) : null}
        <Image
          src={proShot(name)}
          alt={alt}
          width={width}
          height={height}
          priority={priority}
          loading={priority ? "eager" : undefined}
          sizes={sizes}
          className="block h-auto w-full"
        />
      </div>

      {mobileName ? (
        <div className="absolute right-0 bottom-0 hidden w-[34%] min-w-[9rem] max-w-[16rem] overflow-hidden rounded-[1.6rem] border-[6px] border-[#0b1a2e] bg-[#0b1a2e] shadow-[0_28px_50px_-24px_rgba(2,16,36,0.6)] sm:block">
          <Image
            src={proShot(mobileName)}
            alt={mobileAlt ?? alt}
            width={MOBILE_SHOT.width}
            height={MOBILE_SHOT.height}
            priority={priority}
            loading={priority ? "eager" : undefined}
            sizes="(min-width: 1280px) 16vw, 34vw"
            className="block h-auto w-full rounded-[1.05rem]"
          />
        </div>
      ) : null}
    </div>
  );
}
