"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Container, Section } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import type { ExploreColumn } from "@/lib/data/profile-explore";

const PREVIEW = 6;

export function ProfileExplore({ columns }: { columns: ExploreColumn[] }) {
  if (!columns.length) return null;

  return (
    <Section density="tight">
      <Container className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <p className="eyebrow text-muted-foreground">Explore around this pro</p>
          <h2 className="max-w-2xl text-2xl font-semibold md:text-3xl">
            Compare estimates, nearby trades, and other areas they cover
          </h2>
        </div>
        <div data-stagger className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {columns.map((column) => (
            <ExploreColumnList key={column.id} column={column} />
          ))}
        </div>
      </Container>
    </Section>
  );
}

function ExploreColumnList({ column }: { column: ExploreColumn }) {
  const [open, setOpen] = useState(false);
  const extra = column.links.length > PREVIEW;
  const visible = open ? column.links : column.links.slice(0, PREVIEW);

  return (
    <div className="flex flex-col rounded-xl border border-input bg-card p-5">
      <div className="flex flex-col gap-1">
        <p className="eyebrow text-muted-foreground">{column.eyebrow}</p>
        <h3 className="text-lg font-semibold">{column.title}</h3>
      </div>
      <ul className="mt-3 flex flex-col">
        {visible.map((link) => (
          <li key={`${column.id}-${link.href}-${link.label}`}>
            <Link
              href={link.href}
              className="group flex items-center justify-between gap-2 border-b border-input py-2.5 text-sm font-medium text-primary last:border-b-0 hover:text-primary/80"
            >
              <span className="underline-offset-2 group-hover:underline">{link.label}</span>
              <ChevronRight
                className="size-4 shrink-0 text-primary/40 transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                aria-hidden="true"
              />
            </Link>
          </li>
        ))}
      </ul>
      {extra ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2 h-auto w-fit px-0 text-sm font-semibold text-primary hover:bg-transparent hover:text-primary/80"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Show less" : "Show more"}
        </Button>
      ) : null}
    </div>
  );
}
