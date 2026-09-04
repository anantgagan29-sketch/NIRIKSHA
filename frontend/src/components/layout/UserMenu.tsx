import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, LogOut, Settings, ShieldCheck, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "U";

export function UserMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) {
    return (
      <Link
        to="/login"
        className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-canvas hover:text-ink"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-1.5 transition-colors hover:bg-canvas sm:pr-2"
      >
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 font-display text-xs font-bold text-brand-700"
        >
          {initials(user.name)}
        </span>
        <span className="hidden max-w-[8rem] truncate text-sm font-medium text-ink lg:block">
          {user.name}
        </span>
        <ChevronDown className="hidden h-4 w-4 shrink-0 text-faint lg:block" aria-hidden="true" />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-60 rounded-xl border border-line bg-surface p-1.5 shadow-xl">
          <div className="border-b border-line px-3 pb-2.5 pt-2">
            <p className="truncate text-sm font-medium text-ink">{user.name}</p>
            <p className="mt-0.5 truncate text-[12px] text-muted">{user.email}</p>
            <span
              className={cn(
                "mt-2 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-medium",
                user.role === "authority"
                  ? "border-brand-200 bg-brand-50 text-brand-700"
                  : "border-line bg-canvas text-muted",
              )}
            >
              {user.role === "authority" && <ShieldCheck className="h-3 w-3" aria-hidden="true" />}
              {user.role === "authority" ? "Authority account" : "Citizen account"}
            </span>
          </div>

          <div className="pt-1.5">
            {user.role === "authority" && (
              <MenuLink to="/admin" icon={ShieldCheck} onNavigate={() => setOpen(false)}>
                Authority Console
              </MenuLink>
            )}
            <MenuLink to="/settings" icon={Settings} onNavigate={() => setOpen(false)}>
              Settings
            </MenuLink>
            <MenuLink to="/history" icon={User} onNavigate={() => setOpen(false)}>
              My scans
            </MenuLink>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                signOut();
                setOpen(false);
                toast("info", "Signed out.");
                navigate("/");
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-fail transition-colors hover:bg-fail-bg"
            >
              <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  to,
  icon: Icon,
  children,
  onNavigate,
}: {
  to: string;
  icon: typeof Settings;
  children: React.ReactNode;
  onNavigate: () => void;
}) {
  return (
    <Link
      to={to}
      role="menuitem"
      onClick={onNavigate}
      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-2 transition-colors hover:bg-canvas hover:text-ink"
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {children}
    </Link>
  );
}
