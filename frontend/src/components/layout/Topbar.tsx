import { useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Menu, Search, ScanLine } from "lucide-react";
import { BrandLockup } from "./Brand";
import { AccessibilityMenu } from "./AccessibilityMenu";
import { ThemeToggle } from "./ThemeToggle";
import { ButtonLink } from "@/components/ui/Button";
import { UserMenu } from "./UserMenu";
import { useLanguage } from "@/hooks/useLanguage";
import { LanguageMenu } from "./LanguageMenu";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { t } = useLanguage();
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-3 px-4 sm:gap-4 sm:px-6">
        <button
          type="button"
          onClick={onMenu}
          aria-label="Open navigation"
          className="rounded-lg p-2 text-muted transition-colors hover:bg-canvas hover:text-ink lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <Link to="/" className="shrink-0 lg:hidden">
          <BrandLockup className="max-w-[8.5rem]" />
        </Link>

        <p className="hidden shrink-0 font-display text-sm font-medium text-ink-2 lg:block">
          {t("brand.tagline")}
        </p>

        <div className="relative mx-auto hidden w-full max-w-md md:block">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder={t("search.placeholder")}
            aria-label="Search scans, complaints and reports"
            className="h-10 w-full rounded-full border border-line bg-canvas pl-10 pr-4 text-sm text-ink placeholder:text-faint outline-none transition-colors focus:border-brand-400 focus:bg-surface focus:ring-2 focus:ring-brand-100"
          />
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
          <LanguageMenu />

          <ThemeToggle />

          <AccessibilityMenu />

          <div className="relative">
            <button
              type="button"
              onClick={() => setNotificationsOpen((value) => !value)}
              aria-label="Notifications, 3 unread"
              aria-expanded={notificationsOpen}
              className="relative rounded-lg p-2 text-muted transition-colors hover:bg-canvas hover:text-ink"
            >
              <Bell className="h-[18px] w-[18px]" />
              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-fail text-[9px] font-bold text-white">
                3
              </span>
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-line bg-surface p-2 shadow-xl">
                <p className="px-2 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-faint">
                  Notifications
                </p>
                {[
                  { title: "Complaint NIR-CMP-2026-00481 moved to Under Review", when: "2 hours ago" },
                  { title: "Grainwell Digestive Biscuits — 2 potential issues", when: "Yesterday" },
                  { title: "Weekly compliance summary is ready", when: "3 days ago" },
                ].map((item) => (
                  <div key={item.title} className="rounded-lg px-2.5 py-2 transition-colors hover:bg-canvas">
                    <p className="text-[13px] leading-snug text-ink">{item.title}</p>
                    <p className="mt-0.5 text-[11px] text-faint">{item.when}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <UserMenu />

          <ButtonLink to="/inspect" size="sm" className="ml-1 hidden sm:inline-flex">
            <ScanLine className="h-4 w-4" aria-hidden="true" />
            Inspect Product
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
