import { useState } from "react";
import { Loader2, ShoppingCart } from "lucide-react";

import { PageHeader, AssessmentNotice } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Form";
import { StatusPill, resultPill } from "@/components/ui/StatusPill";
import { CheckList } from "@/components/compliance/CheckList";
import { useToast } from "@/components/ui/Toast";
import { checkListing, HAS_BACKEND, type ListingOutcome } from "@/services/nirikshaApi";

/**
 * Compliance of an e-commerce listing.
 *
 * A packaged commodity sold online has to show the purchaser the same
 * declarations the pack carries — they cannot turn the box over before
 * buying. The listing's text is assessed by the same rules engine a
 * photographed label goes through, and cites the same provisions.
 *
 * The text is pasted rather than fetched from a URL. Retrieving a page from
 * the server would mean this service fetching addresses a visitor chooses,
 * and would in any case fail against the platforms that matter, which refuse
 * automated retrieval. Pasting what is on screen is honest about what was
 * assessed, and it works.
 */
export function Listing() {
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [platform, setPlatform] = useState("");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<ListingOutcome | null>(null);
  const toast = useToast();

  async function assess() {
    if (busy || text.trim().length < 20) return;

    setBusy(true);
    setOutcome(null);

    try {
      setOutcome(await checkListing(text.trim(), url.trim(), platform.trim()));
    } catch (cause) {
      toast(
        "warning",
        cause instanceof Error ? cause.message : "The listing could not be assessed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow="E-commerce"
        title="Listing compliance"
        description="Assess whether an online listing shows the declarations the Rules require."
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="The listing" />
          <CardBody className="flex flex-col gap-4">
            <div>
              <label htmlFor="listing-text" className="block text-[13.5px] font-medium text-ink">
                Listing text
              </label>
              <p className="mt-1 text-[12px] leading-relaxed text-muted">
                Copy what the product page shows a buyer — the title, the description and the
                product details block. Paste it here.
              </p>
              <textarea
                id="listing-text"
                rows={12}
                value={text}
                onChange={(event) => setText(event.target.value)}
                disabled={busy}
                placeholder={"Product title\n\nNet Quantity: 225 g\nMRP: Rs. 55.00\nMarketed by: …\nCountry of Origin: India"}
                className="mt-2.5 w-full rounded-lg border border-line-strong bg-surface px-3.5 py-3 font-mono text-[12.5px] leading-relaxed text-ink outline-none transition-colors focus:border-brand-400"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Listing URL (optional)" htmlFor="listing-url">
                <Input
                  id="listing-url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://…"
                  disabled={busy}
                />
              </Field>
              <Field label="Platform (optional)" htmlFor="listing-platform">
                <Input
                  id="listing-platform"
                  value={platform}
                  onChange={(event) => setPlatform(event.target.value)}
                  placeholder="Marketplace name"
                  disabled={busy}
                />
              </Field>
            </div>

            <p className="text-[12px] leading-relaxed text-muted">
              The URL is recorded with the assessment so a finding can be traced back. The page
              is not fetched — what is assessed is what you paste.
            </p>

            <Button onClick={() => void assess()} disabled={busy || text.trim().length < 20 || !HAS_BACKEND}>
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Assessing listing…
                </>
              ) : (
                <>
                  <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                  Assess listing
                </>
              )}
            </Button>
          </CardBody>
        </Card>

        <div className="flex flex-col gap-6">
          {outcome ? (
            <>
              <Card>
                <CardHeader
                  title="Assessment"
                  action={outcome.result && <StatusPill {...resultPill(outcome.result)} size="sm" />}
                />
                <CardBody className="flex flex-col gap-3">
                  <p className="text-[13px] text-muted">
                    Score <span className="tnum font-mono text-ink">{outcome.score}</span>
                  </p>

                  <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {[
                      ["Product", outcome.productName],
                      ["Net quantity", outcome.netQuantity],
                      ["MRP", outcome.mrp],
                    ].map(([label, value]) => (
                      <div key={label as string}>
                        <dt className="text-[11px] uppercase tracking-wider text-faint">{label}</dt>
                        <dd className="mt-0.5 text-[13px] text-ink">
                          {value ?? <span className="text-muted">Not stated</span>}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  {/* What the listing path can and cannot answer, next to the
                      result rather than in small print underneath it. */}
                  <p className="rounded-lg border border-line bg-canvas px-3.5 py-3 text-[12px] leading-relaxed text-muted">
                    {outcome.note}
                  </p>
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Requirements assessed" />
                <CardBody className="p-0">
                  <CheckList checks={outcome.checks} />
                </CardBody>
              </Card>
            </>
          ) : (
            <Card>
              <CardBody>
                <p className="text-[13px] leading-relaxed text-muted">
                  Paste a listing and assess it. Every requirement is tested by the same engine a
                  photographed label goes through, and each finding cites the provision it comes
                  from.
                </p>
              </CardBody>
            </Card>
          )}

          <AssessmentNotice />
        </div>
      </div>
    </div>
  );
}
