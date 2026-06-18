"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, DEMO_LOGINS } from "@/lib/auth";
import { Button, Input } from "@/components/ui";

// PRD §4.3 auth flow: email+password → TOTP challenge → session.
// Step 1 and 2 are faked client-side here (see lib/auth.tsx). The real flow
// posts to /api/lea/admin/auth/* and sets httpOnly cookies.
export default function LoginPage() {
  const { signIn, verifyTotp, pendingEmail } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("super@legali.ai");
  const [password, setPassword] = useState("demo");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submitCredentials = async () => {
    setError(null);
    const res = await signIn(email, password);
    if (!res.ok) setError(res.error ?? "Login failed.");
  };

  const submitTotp = async () => {
    setError(null);
    const res = await verifyTotp(code);
    if (!res.ok) setError(res.error ?? "Verification failed.");
    else router.replace("/dashboard");
  };

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm">
        {/* Lea mascot — warm welcome on the sign-in screen. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/lea/module-1.png" alt="Lea" className="mx-auto mb-3 h-28 w-28 object-contain drop-shadow-sm" />
        <div className="mb-6 flex items-baseline justify-center gap-1.5">
          <span className="text-2xl font-bold tracking-tight text-brand-700">Lea</span>
          <span className="text-2xl font-semibold tracking-tight text-slate-700">Admin</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {!pendingEmail ? (
            <>
              <h1 className="mb-4 text-base font-semibold text-slate-900">Sign in</h1>
              <div className="space-y-3">
                <Input value={email} onChange={setEmail} placeholder="Email" type="email" />
                <Input value={password} onChange={setPassword} placeholder="Password" type="password" />
                {error && <p className="text-xs text-rose-600">{error}</p>}
                <Button type="button" onClick={submitCredentials} className="w-full">
                  Continue
                </Button>
              </div>
            </>
          ) : (
            <>
              <h1 className="mb-1 text-base font-semibold text-slate-900">Two-factor authentication</h1>
              <p className="mb-4 text-xs text-slate-500">Enter the 6-digit code from your authenticator app.</p>
              <div className="space-y-3">
                <Input value={code} onChange={setCode} placeholder="123456" />
                {error && <p className="text-xs text-rose-600">{error}</p>}
                <Button type="button" onClick={submitTotp} className="w-full">
                  Verify &amp; sign in
                </Button>
              </div>
            </>
          )}
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-white/60 p-3 text-xs text-slate-500">
          <p className="mb-1 font-medium text-slate-600">Demo accounts (password: <code>demo</code>, any 6-digit code):</p>
          <ul className="space-y-0.5">
            {DEMO_LOGINS.map((d) => (
              <li key={d.email}>
                <button className="text-brand-600 hover:underline" onClick={() => { setEmail(d.email); setPassword("demo"); }}>
                  {d.email}
                </button>{" "}
                — {d.role}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
