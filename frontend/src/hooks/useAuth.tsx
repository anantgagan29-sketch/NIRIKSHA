import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { HAS_SUPABASE, supabase } from "@/services/supabase";

/**
 * Account handling.
 *
 * Two implementations sit behind one interface, chosen by whether a Supabase
 * project is configured:
 *
 *   **Supabase** — real accounts. The password is checked on Supabase's
 *   servers, never in this page; the session is a signed token the library
 *   keeps and refreshes; a password reset goes out as an email link, because
 *   letting the browser set a new password for any address it names is not a
 *   reset, it is a takeover.
 *
 *   **Local store** — the fallback when no project is configured, so the build
 *   still runs for anyone without credentials. Accounts live in this browser's
 *   localStorage, salted and SHA-256 hashed. That is a courtesy, not security:
 *   anything running in the page can read the store, and a hash computed on
 *   the client proves nothing to a server. It is for development, not for use.
 *
 * `usingRealAccounts` says which is in force, so the interface can be honest
 * about it rather than implying a security boundary that is not there.
 *
 * Every component reads this hook and nothing else, so swapping the two
 * changes nothing above it.
 */

export type Role = "citizen" | "authority";

export interface Account {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}

interface StoredAccount extends Account {
  salt: string;
  passwordHash: string;
}

interface AuthValue {
  user: Account | null;
  /** Null while the stored session is still being read. */
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => void;
  resetPassword: (email: string, password: string) => Promise<void>;
  /** True when an account exists for this address. Used by the reset flow. */
  accountExists: (email: string) => boolean;
  /** False when accounts are the browser-local development store. */
  usingRealAccounts: boolean;
  /**
   * Starts a password reset.
   *
   * Returns true when an email has been sent and the flow ends there. Returns
   * false when there is no mail to send — the local store — and the caller
   * should collect a new password itself.
   */
  sendPasswordReset: (email: string) => Promise<boolean>;
}

const USERS_KEY = "niriksha.users";
const SESSION_KEY = "niriksha.session";

const AuthContext = createContext<AuthValue | null>(null);

/* ------------------------------------------------------------- storage */

function readUsers(): StoredAccount[] {
  try {
    const raw = window.localStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as StoredAccount[]) : [];
  } catch {
    return [];
  }
}

function writeUsers(users: StoredAccount[]) {
  try {
    window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch {
    // Storage can be unavailable in a private window; the session still works
    // for as long as the tab is open.
  }
}

function publicOf(account: StoredAccount): Account {
  const { salt: _salt, passwordHash: _hash, ...rest } = account;
  return rest;
}

/** Salted SHA-256 via the Web Crypto API (available on https and localhost). */
async function hashPassword(password: string, salt: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function newSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const normalise = (email: string) => email.trim().toLowerCase();

/** Supabase's messages are written for developers; these are for the form. */
function describe(message: string): string {
  const text = message.toLowerCase();

  if (text.includes("invalid login credentials")) {
    return "That email address or password is incorrect.";
  }
  if (text.includes("already registered") || text.includes("already been registered")) {
    return "An account with that email address already exists.";
  }
  if (text.includes("email not confirmed")) {
    return "This account has not been confirmed yet. Check your email for the link.";
  }
  if (text.includes("password") && text.includes("least")) {
    return "That password is too short. Use at least six characters.";
  }
  if (text.includes("rate limit") || text.includes("too many")) {
    return "Too many attempts. Wait a moment and try again.";
  }
  if (text.includes("fetch") || text.includes("network")) {
    return "Could not reach the sign-in service. Check your connection.";
  }

  return message;
}

/**
 * A Supabase user as this application sees it.
 *
 * The role comes from `user_metadata`, which the account holder can edit, so
 * it decides what the interface offers — not what the data allows. Anything
 * that must actually be enforced belongs in row-level security or in the API,
 * where the user cannot reach it.
 */
function accountOf(user: { id: string; email?: string; created_at?: string; user_metadata?: Record<string, unknown> }): Account {
  const meta = user.user_metadata ?? {};
  const role = meta.role === "authority" ? "authority" : "citizen";

  return {
    id: user.id,
    name: typeof meta.name === "string" && meta.name.trim() ? meta.name : (user.email ?? "Account"),
    email: user.email ?? "",
    role,
    createdAt: user.created_at ?? new Date().toISOString(),
  };
}

/* -------------------------------------------------------------- provider */

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Account | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!supabase) {
      try {
        const id = window.localStorage.getItem(SESSION_KEY);
        const account = id ? readUsers().find((u) => u.id === id) : undefined;
        if (account) setUser(publicOf(account));
      } catch {
        // No session is a valid state.
      }
      setReady(true);
      return;
    }

    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setUser(data.session ? accountOf(data.session.user) : null);
      setReady(true);
    });

    // Sign-in, sign-out and token refresh all arrive here, including those
    // that happen in another tab — so signing out once signs out everywhere.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session ? accountOf(session.user) : null);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (supabase) {
      const { error } = await supabase.auth.signInWithPassword({
        email: normalise(email),
        password,
      });

      // Supabase already answers wrong-password and unknown-address with the
      // same message, which is what keeps this form from being used to find
      // out which addresses have accounts.
      if (error) throw new Error(describe(error.message));
      return;
    }

    const account = readUsers().find((u) => u.email === normalise(email));

    // One message for both failure modes, so this form cannot be used to
    // discover which addresses have accounts.
    const invalid = new Error("That email address or password is incorrect.");
    if (!account) throw invalid;
    if ((await hashPassword(password, account.salt)) !== account.passwordHash) throw invalid;

    window.localStorage.setItem(SESSION_KEY, account.id);
    setUser(publicOf(account));
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    if (supabase) {
      const { data, error } = await supabase.auth.signUp({
        email: normalise(email),
        password,
        options: { data: { name: name.trim(), role: "citizen" } },
      });

      if (error) throw new Error(describe(error.message));

      // With email confirmation switched on, no session is returned and the
      // account is not usable until the link is clicked. Saying so is better
      // than a sign-up that appears to work and then will not sign in.
      if (!data.session) {
        throw new Error(
          "Account created. Check your email for the confirmation link, then sign in.",
        );
      }

      return;
    }

    const users = readUsers();
    if (users.some((u) => u.email === normalise(email))) {
      throw new Error("An account with that email address already exists.");
    }

    const salt = newSalt();
    const account: StoredAccount = {
      id: crypto.randomUUID(),
      name: name.trim(),
      email: normalise(email),
      // The first account on a fresh browser gets the authority console, so a
      // new install is usable without a seeding step.
      role: users.length === 0 ? "authority" : "citizen",
      createdAt: new Date().toISOString(),
      salt,
      passwordHash: await hashPassword(password, salt),
    };

    writeUsers([...users, account]);
    window.localStorage.setItem(SESSION_KEY, account.id);
    setUser(publicOf(account));
  }, []);

  const signOut = useCallback(() => {
    if (supabase) {
      // The listener clears the user; doing it here too means the interface
      // does not sit signed-in while the request is in flight.
      void supabase.auth.signOut();
      setUser(null);
      return;
    }

    window.localStorage.removeItem(SESSION_KEY);
    setUser(null);
  }, []);

  /**
   * Sets a new password directly.
   *
   * A real system emails a time-limited, single-use link and never lets the
   * browser decide who may reset what. The reset screen says so plainly.
   */
  const resetPassword = useCallback(async (email: string, password: string) => {
    const users = readUsers();
    const index = users.findIndex((u) => u.email === normalise(email));
    if (index < 0) throw new Error("No account was found for that email address.");

    const salt = newSalt();
    users[index] = { ...users[index], salt, passwordHash: await hashPassword(password, salt) };
    writeUsers(users);
  }, []);

  const accountExists = useCallback(
    (email: string) => readUsers().some((u) => u.email === normalise(email)),
    [],
  );

  /**
   * Sends a reset link, when there is a mail service to send it.
   *
   * Success is reported the same way whether or not the address has an
   * account: telling a stranger which addresses are registered is the whole
   * problem this flow otherwise creates.
   */
  const sendPasswordReset = useCallback(async (email: string) => {
    if (!supabase) return false;

    await supabase.auth.resetPasswordForEmail(normalise(email), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    return true;
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      ready,
      signIn,
      signUp,
      signOut,
      resetPassword,
      accountExists,
      usingRealAccounts: HAS_SUPABASE,
      sendPasswordReset,
    }),
    [user, ready, signIn, signUp, signOut, resetPassword, accountExists, sendPasswordReset],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>.");
  return value;
}
