import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * Account handling for a frontend-only build.
 *
 * ── Read this before shipping ─────────────────────────────────────────────
 * Accounts live in this browser's localStorage. Passwords are salted and
 * hashed with SHA-256 rather than stored in the clear, but that is a courtesy,
 * not security: anything running in the page can read the store, and a hash
 * computed on the client proves nothing to a server.
 *
 * Real authentication belongs on the backend — a session cookie or token
 * issued after a server-side check, with the password never leaving the wire
 * unhashed. When that endpoint exists, replace the four functions below
 * (`signIn`, `signUp`, `signOut`, `resetPassword`) with fetch calls. Every
 * component reads this hook and nothing else, so nothing above it changes.
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

/* -------------------------------------------------------------- provider */

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Account | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const id = window.localStorage.getItem(SESSION_KEY);
      const account = id ? readUsers().find((u) => u.id === id) : undefined;
      if (account) setUser(publicOf(account));
    } catch {
      // No session is a valid state.
    }
    setReady(true);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
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

  const value = useMemo<AuthValue>(
    () => ({ user, ready, signIn, signUp, signOut, resetPassword, accountExists }),
    [user, ready, signIn, signUp, signOut, resetPassword, accountExists],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>.");
  return value;
}
