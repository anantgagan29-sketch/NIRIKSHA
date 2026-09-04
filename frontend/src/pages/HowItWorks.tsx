import { motion } from "framer-motion";
import { Camera, Eye, ScanText, Scale, FileCheck } from "lucide-react";
import { PageHeader, AssessmentNotice } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { HeroVisual } from "@/components/3d/HeroVisual";
import { JOURNEY } from "@/data/pipeline";
import { useLanguage } from "@/hooks/useLanguage";

const ICONS = [Camera, Eye, ScanText, Scale, FileCheck];

const PRINCIPLES = [
  {
    title: "A poor image is stopped, not guessed at",
    body: "Sharpness, exposure, resolution and text visibility are measured before anything is read. Reading text from an unreadable frame produces a confident-looking result from nothing, which is worse than asking for another photograph.",
  },
  {
    title: "Requirements are conditional, not a checklist",
    body: "Country of origin governs imported packages. Best before governs commodities that become unfit over time. A requirement that does not reach a package is marked not applicable, with the reason — never counted as a failure.",
  },
  {
    title: "Format matters, not just presence",
    body: "A bare price satisfies the check that a price exists and fails the check that it is declared in the prescribed form. Reading the number is not the same as understanding the declaration.",
  },
  {
    title: "A poor reading never becomes an accusation",
    body: "Where a value was read at low confidence, the outcome is “needs review”, not “fail”. We could not read it is not the same claim as it is not there.",
  },
];

export function HowItWorks() {
  const { t } = useLanguage();
  return (
    <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6">
      <div className="hero-wash -mx-4 mb-10 grid items-center gap-8 px-4 py-8 sm:-mx-6 sm:px-6 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <PageHeader
            eyebrow={t("howItWorks.eyebrow")}
            title={t("howItWorks.title")}
            description={t("howItWorks.description")}
            actions={<ButtonLink to="/inspect">Inspect a Product</ButtonLink>}
          />
        </div>
        <HeroVisual />
      </div>

      <ol className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {JOURNEY.map((stage, index) => {
          const Icon = ICONS[index];
          return (
            <motion.li
              key={stage.index}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08, duration: 0.4 }}
            >
              <Card className="h-full">
                <CardBody className="flex h-full flex-col gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-teal text-white shadow-sm"
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <p className="font-mono text-[11px] text-brand-600">{stage.index}</p>
                  <h3 className="font-display text-base font-semibold text-ink">{stage.title}</h3>
                  <p className="text-[13px] leading-relaxed text-muted">{stage.body}</p>
                </CardBody>
              </Card>
            </motion.li>
          );
        })}
      </ol>

      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold text-ink">
          Four decisions that shape every result
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          In a system adjacent to enforcement, a false accusation costs more than a missed issue.
          These are the rules that follow from that.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {PRINCIPLES.map((principle, index) => (
            <motion.div
              key={principle.title}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: index * 0.06, duration: 0.35 }}
            >
              <Card className="h-full">
                <CardBody className="flex flex-col gap-2">
                  <h3 className="font-display text-[15px] font-semibold text-ink">{principle.title}</h3>
                  <p className="text-[13px] leading-relaxed text-muted">{principle.body}</p>
                </CardBody>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-2">
        <Card>
          <CardBody className="flex flex-col gap-3">
            <h3 className="font-display text-base font-semibold text-ink">Rules this assesses against</h3>
            <p className="text-[13px] leading-relaxed text-muted">
              The Legal Metrology (Packaged Commodities) Rules, 2011 govern the declarations a
              pre-packaged commodity must carry and the form they must take. Some declarations that
              commonly appear on food packaging — best before dates among them — sit under food
              safety law rather than Legal Metrology, and are treated as separately sourced.
            </p>
            <p className="text-[13px] leading-relaxed text-muted">
              Every check in this interface names the provision it comes from, so a result can be
              traced back to the instrument behind it.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex flex-col gap-3">
            <h3 className="font-display text-base font-semibold text-ink">What this build is</h3>
            <p className="text-[13px] leading-relaxed text-muted">
              This is a frontend demonstration. It runs on local demonstration data through a mock
              service layer, with no recognition engine, database or government system connected to
              it. Product records, scan history and complaints shown here are illustrative.
            </p>
            <AssessmentNotice />
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
