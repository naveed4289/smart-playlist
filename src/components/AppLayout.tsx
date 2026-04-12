import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

type Props = {
  children: React.ReactNode;
  fluid?: boolean;
  searchSlot?: React.ReactNode;
};

export function AppLayout({ children, fluid = false, searchSlot }: Props) {
  const { user, signOut } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const email = user?.email ?? "";
  const username =
    (user?.user_metadata?.username as string | undefined) ??
    email.split("@")[0] ??
    (user ? user.id.slice(0, 8) : "");

  const initials = username
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("") || "?";

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="flex h-screen flex-col bg-slate-100 text-slate-900">

      {/* ── Navbar ── */}
      <header className="z-30 shrink-0 border-b border-slate-200 bg-white shadow-sm">
        <div className="flex items-center px-4 py-2 sm:px-5">

          {/* Logo — same width as left sidebar */}
          <Link to="/" className="flex w-52 shrink-0 items-center gap-2.5 xl:w-56">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white text-base font-black shadow-sm">
              ♫
            </span>
            <span className="hidden text-sm font-bold tracking-tight text-slate-800 sm:inline">
              Smart Playlist
            </span>
          </Link>

          {/* Search slot — always flex-1 so the right section never shifts */}
          <div className="min-w-0 flex-1 px-3">
            {searchSlot}
          </div>

          {/* Right: user menu — same width as right sidebar */}
          <div className="flex w-64 shrink-0 items-center justify-end gap-2 xl:w-72">
            {user ? (
              <div ref={dropdownRef} className="relative">
                <button
                  type="button"
                  onClick={() => setDropdownOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-1.5 pr-3 transition hover:border-slate-300 hover:bg-white"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white">
                    {initials}
                  </span>
                  <span className="hidden flex-col items-start sm:flex">
                    <span className="max-w-[110px] truncate text-xs font-semibold text-slate-800 leading-tight">
                      {username}
                    </span>
                    <span className="hidden max-w-[130px] truncate text-[10px] text-slate-400 leading-tight sm:block">
                      {email}
                    </span>
                  </span>
                  <svg
                    className={`h-3 w-3 shrink-0 text-slate-400 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 animate-[fadeIn_0.12s_ease-out] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl z-50">
                    <div className="border-b border-slate-100 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-sm font-bold text-white">
                          {initials}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800">{username}</p>
                          <p className="truncate text-xs text-slate-400">{email}</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-1.5">
                      <button
                        type="button"
                        onClick={() => { setDropdownOpen(false); void signOut(); }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link to="/login" className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition">
                  Log in
                </Link>
                <Link to="/signup" className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition">
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {fluid ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      ) : (
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">{children}</div>
        </main>
      )}
    </div>
  );
}
