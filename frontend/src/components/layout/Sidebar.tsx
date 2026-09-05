import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingCart,
  ScanLine,
  History,
  AlertCircle,
  FileText,
  Info,
  ShieldCheck,
  Settings,
  Phone,
  X,
} from "lucide-react";
import { BrandLockup } from "./Brand";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/cn";

const NAV = [
  { to: "/", key: "nav.dashboard", icon: LayoutDashboard, end: true },
  { to: "/inspect", key: "nav.inspect", icon: ScanLine },
  { to: "/listing", key: "nav.listing", icon: ShoppingCart },
  { to: "/history", key: "nav.history", icon: History },
  { to: "/complaints", key: "nav.complaints", icon: AlertCircle },
  { to: "/reports", key: "nav.reports", icon: FileText },
  { to: "/how-it-works", key: "nav.howItWorks", icon: Info },
] as const;

const AUTHORITY_ITEM = { to: "/admin", key: "nav.admin", icon: ShieldCheck } as const;
const SETTINGS_ITEM = { to: "/settings", key: "nav.settings", icon: Settings } as const;

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLanguage();
  const { user } = useAuth();

  // A link that only leads to a sign-in redirect is a small lie about what
  // the product does, so the console appears only when it is reachable.
  const secondary = user?.role === "authority" ? [AUTHORITY_ITEM, SETTINGS_ITEM] : [SETTINGS_ITEM];

  const item = ({ isActive }: { isActive: boolean }) =>
    cn(
      "group flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm transition-colors",
      isActive
        ? "bg-white font-semibold text-brand-800 shadow-sm"
        : "text-white/70 hover:bg-white/10 hover:text-white",
    );

  return (
    <>
      {/* Mobile scrim */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={cn(
          "fixed inset-0 z-40 bg-console-deep/50 backdrop-blur-[2px] transition-opacity lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        aria-label="Primary"
        className={cn(
          "console-texture fixed inset-y-0 left-0 z-50 flex w-[15.5rem] shrink-0 flex-col bg-console transition-transform duration-300 lg:sticky lg:top-0 lg:z-auto lg:h-dvh lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between gap-3 px-5 pb-6 pt-6">
          <BrandLockup onDark className="max-w-[10.5rem]" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
          {NAV.map((entry) => (
            <NavLink key={entry.to} to={entry.to} end={"end" in entry ? entry.end : undefined} className={item} onClick={onClose}>
              <entry.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
              {t(entry.key)}
            </NavLink>
          ))}

          <div className="my-3 h-px bg-console-line" />

          {secondary.map((entry) => (
            <NavLink key={entry.to} to={entry.to} className={item} onClick={onClose}>
              <entry.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
              {t(entry.key)}
            </NavLink>
          ))}
        </nav>

        <div className="m-3 rounded-xl border border-console-line bg-white/[0.06] p-4">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white"
            >
              <Phone className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[13px] font-semibold text-white">Need Help?</p>
              <p className="font-mono text-[11px] text-white/60">1800-123-4567</p>
            </div>
          </div>
          <p className="mt-2.5 text-[11px] leading-relaxed text-white/45">
            Mon – Fri, 10 AM – 6 PM. Demonstration contact only.
          </p>
        </div>
      </aside>
    </>
  );
}
