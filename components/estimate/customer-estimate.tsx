"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { EstimatePdfDocument, SignaturePadField, typedSignature, useSignPad } from "@/components/estimate/estimate-pdf";
import {
  shareTokenFor,
  useEstimateShare,
  type EstimateShareSnapshot,
} from "@/components/portal/use-estimate-share";
import { Button } from "@/components/ui/button";
import { formatDate, formatMoney } from "@/lib/format";

export function CustomerEstimatePage({ token }: { token: string }) {
  const share = useEstimateShare();
  const snapshot = share.snapshotOf(token) ?? share.snapshotOf(shareTokenFor(token.replace(/^s_/, "")));
  const approval = snapshot ? share.approvalOf(snapshot.estimateId) : undefined;

  if (!snapshot) {
    return (
      <main id="main-content" className="min-h-svh bg-[#eef1f5] px-4 py-16">
        <div className="mx-auto max-w-lg border border-black/15 bg-card p-8 text-center">
          <h1 className="text-xl font-semibold">Estimate link not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ask the company to send the estimate again. The link is created when they send it for approval.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main id="main-content" className="min-h-svh bg-[#eef1f5] px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <EstimatePdfDocument
          snapshot={snapshot}
          approval={approval}
          customerSlot={
            approval ? undefined : (
              <CustomerSignSlot snapshot={snapshot} onSign={(name, image) => share.approve(snapshot, name, image)} />
            )
          }
        />
        {approval ? (
          <p className="mx-auto mt-4 flex max-w-[8.5in] items-center gap-2 rounded-[4px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
            <CheckCircle2 className="size-4" />
            Signed by {approval.signedBy} on {formatDate(approval.signedAt.slice(0, 10))}
          </p>
        ) : null}
      </div>
    </main>
  );
}

function CustomerSignSlot({
  snapshot,
  onSign,
}: {
  snapshot: EstimateShareSnapshot;
  onSign: (name: string, image: string) => void;
}) {
  const [name, setName] = useState(snapshot.customerName);
  const [agreed, setAgreed] = useState(false);
  const pad = useSignPad();

  return (
    <div className="mt-2">
      <SignaturePadField name={name} onName={setName} pad={pad} />
      <label className="mt-3 flex items-start gap-2 text-[11px] leading-4">
        <input type="checkbox" className="mt-0.5" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
        <span>
          I have read pages 1 and 2 and authorize {snapshot.companyName} to proceed for {formatMoney(snapshot.total)}.
        </span>
      </label>
      <Button
        className="mt-3"
        size="sm"
        disabled={!name.trim() || !agreed}
        onClick={() => {
          const image = pad.dirty ? pad.toImage() : typedSignature(name.trim());
          if (!image) return;
          onSign(name.trim(), image);
        }}
      >
        Sign and approve {snapshot.number}
      </Button>
    </div>
  );
}

export function EstimateDocument({ snapshot }: { snapshot: EstimateShareSnapshot }) {
  return <EstimatePdfDocument snapshot={snapshot} />;
}
