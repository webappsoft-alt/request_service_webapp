"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PortalPaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  totalPages?: number;
  onPageChange: (page: number) => void;
  itemName?: string;
  className?: string;
};

export function PortalPagination({
  page,
  pageSize,
  total,
  totalPages: propTotalPages,
  onPageChange,
  itemName = "records",
  className,
}: PortalPaginationProps) {
  const totalPages = propTotalPages ?? Math.max(1, Math.ceil(total / pageSize));

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  const pageNumbers = useMemo(() => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (page <= 3) {
      return [1, 2, 3, 4, totalPages];
    }
    if (page >= totalPages - 2) {
      return [1, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, page - 1, page, page + 1, totalPages];
  }, [page, totalPages]);

  if (total <= 0) return null;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-between gap-3 border-t border-black/10 px-2 pt-3 sm:flex-row",
        className,
      )}
    >
      <p className="text-xs text-muted-foreground">
        Showing <span className="font-semibold text-foreground">{start}</span> to{" "}
        <span className="font-semibold text-foreground">{end}</span> of{" "}
        <span className="font-semibold text-foreground">{total}</span> {itemName}
      </p>

      {totalPages > 1 ? (
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="h-8 gap-1 px-2.5 text-xs font-medium"
          >
            <ChevronLeft className="size-3.5" />
            <span className="hidden sm:inline">Previous</span>
          </Button>

          <div className="flex items-center gap-1">
            {pageNumbers.map((num, idx) => {
              const isEllipsis =
                (idx === 1 && num > 2) || (idx === pageNumbers.length - 2 && num < totalPages - 1);

              return (
                <div key={num} className="flex items-center">
                  {isEllipsis && idx === 1 && num > 2 ? (
                    <span className="px-1 text-xs text-muted-foreground">…</span>
                  ) : null}
                  <Button
                    type="button"
                    variant={page === num ? "default" : "outline"}
                    size="sm"
                    onClick={() => onPageChange(num)}
                    className={cn(
                      "h-8 min-w-8 px-2 text-xs font-medium",
                      page === num
                        ? "bg-[#003F7D] text-white hover:bg-[#003264]"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {num}
                  </Button>
                  {isEllipsis && idx === pageNumbers.length - 2 && num < totalPages - 1 ? (
                    <span className="px-1 text-xs text-muted-foreground">…</span>
                  ) : null}
                </div>
              );
            })}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="h-8 gap-1 px-2.5 text-xs font-medium"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
