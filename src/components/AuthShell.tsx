import { Link } from "react-router-dom";

type Props = {
  children: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
};

export function AuthShell({ children, title, subtitle }: Props) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-linear-to-br from-slate-50 via-white to-indigo-50/50 px-4 py-12">

      {/* Subtle background blobs */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-indigo-100/60 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-violet-100/40 blur-3xl" />

      <div className="relative z-10 w-full max-w-sm">

        {/* Card */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/80">

          {/* Card top: logo + title + subtitle */}
          <div className="border-b border-slate-100 px-8 py-7 text-center">
            <Link to="/" className="mb-5 flex justify-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-xl font-black text-white shadow-lg shadow-indigo-600/30">
                ♫
              </span>
            </Link>
            <h1 className="text-[22px] font-bold text-slate-900">{title}</h1>
            {subtitle && (
              <div className="mt-1.5 text-sm text-slate-500">{subtitle}</div>
            )}
          </div>

          {/* Card body: form content */}
          <div className="px-8 py-6">{children}</div>
        </div>

      </div>
    </div>
  );
}
