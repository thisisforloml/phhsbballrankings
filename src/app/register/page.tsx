"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";

const packages = [
  { name: "Standard", price: "PHP XXX per month", features: ["Full scores", "League details"], action: "Select" },
  { name: "Pro", price: "PHP XXX per month", features: ["Standard plus", "Trend charts", "Advanced stats", "Ranking history"], action: "Select" },
  { name: "Institutional", price: "PHP XXX per year", features: ["Pro plus", "API access", "Bulk export", "Custom reports"], action: "Contact Us" }
];

const methods = ["Credit or Debit Card", "GCash", "Maya", "Bank Transfer"];

export default function RegisterPage() {
  const router = useRouter();
  const { registerPremium } = useAuth();
  const [step, setStep] = useState(1);
  const [account, setAccount] = useState({ name: "", email: "", role: "Coach", country: "Philippines" });
  const [selectedPackage, setSelectedPackage] = useState("");
  const [selectedMethod, setSelectedMethod] = useState("");
  const [error, setError] = useState("");

  function submitAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (String(form.get("password")) !== String(form.get("confirmPassword"))) {
      setError("Passwords must match.");
      return;
    }
    setAccount({
      name: String(form.get("name")),
      email: String(form.get("email")).trim().toLowerCase(),
      role: String(form.get("role")),
      country: String(form.get("country"))
    });
    setError("");
    setStep(2);
  }

  function completeRegistration() {
    if (!selectedMethod) return;
    if (!account.email.endsWith("@oncourtrankings.ph")) {
      setError("For local testing, premium accounts must use @oncourtrankings.ph.");
      return;
    }
    registerPremium({ email: account.email, name: account.name || account.email.split("@")[0], isPremium: true });
    router.push("/scores");
  }

  return (
    <main className="min-h-screen bg-surface-50 px-5 pb-16 pt-32">
      <section className="mx-auto w-full max-w-4xl rounded-lg border border-surface-200 bg-white p-6 shadow-panel">
        <div className="text-center leading-none">
          <img src="/oncourt-logo.png" alt="" className="mx-auto h-20 w-20 rounded-md object-contain" />
          <span className="mt-3 block font-display text-4xl font-extrabold text-navy-800">ONCOURT</span>
          <span className="block font-mono text-[0.65rem] uppercase tracking-[0.18em] text-surface-500">Rankings PH</span>
        </div>
        <div className="mx-auto mt-8 flex max-w-xl items-center justify-center gap-3 font-mono text-mono-sm uppercase">
          {["Account", "Package", "Payment"].map((label, index) => (
            <span key={label} className={index + 1 === step ? "text-amber-500" : index + 1 < step ? "text-navy-800" : "text-surface-300"}>
              {label}
            </span>
          ))}
        </div>
        <h1 className="mt-8 text-center font-display text-stat-md text-navy-800">Get Premium Access</h1>
        {step === 1 ? (
          <form onSubmit={submitAccount} className="mx-auto mt-6 grid max-w-xl gap-4">
            <label className="grid gap-2 text-sm font-semibold text-surface-700">Full Name<input name="name" className="min-h-11 rounded-md border border-surface-200 px-3 py-2" required /></label>
            <label className="grid gap-2 text-sm font-semibold text-surface-700">Email Address<input name="email" type="email" className="min-h-11 rounded-md border border-surface-200 px-3 py-2" required /></label>
            <label className="grid gap-2 text-sm font-semibold text-surface-700">Organization Role<select name="role" className="min-h-11 rounded-md border border-surface-200 px-3 py-2"><option>Coach</option><option>Media</option><option>Scout</option><option>Analyst</option><option>Other</option></select></label>
            <label className="grid gap-2 text-sm font-semibold text-surface-700">Country<input name="country" defaultValue="Philippines" className="min-h-11 rounded-md border border-surface-200 px-3 py-2" required /></label>
            <label className="grid gap-2 text-sm font-semibold text-surface-700">Password<input name="password" type="password" className="min-h-11 rounded-md border border-surface-200 px-3 py-2" required /></label>
            <label className="grid gap-2 text-sm font-semibold text-surface-700">Confirm Password<input name="confirmPassword" type="password" className="min-h-11 rounded-md border border-surface-200 px-3 py-2" required /></label>
            <button className="button primary" type="submit">Continue</button>
          </form>
        ) : null}
        {step === 2 ? (
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {packages.map((item) => (
              <button key={item.name} onClick={() => { setSelectedPackage(item.name); if (item.name !== "Institutional") setStep(3); }} className={`rounded-lg border p-5 text-left transition ${selectedPackage === item.name ? "border-2 border-amber-500 bg-amber-100" : "border-surface-200 bg-white hover:border-amber-500"}`}>
                <h2 className="font-display text-3xl uppercase text-navy-800">{item.name}</h2>
                <p className="mt-1 font-mono text-mono-sm uppercase text-surface-500">{item.price}</p>
                <div className="mt-5 grid gap-2 text-sm text-surface-600">
                  {item.features.map((feature) => <span key={feature}>{feature}</span>)}
                </div>
                <span className="mt-6 inline-flex font-semibold text-amber-600">{item.action}</span>
              </button>
            ))}
          </div>
        ) : null}
        {step === 3 ? (
          <div className="mx-auto mt-8 grid max-w-3xl gap-5">
            <div className="grid gap-3 md:grid-cols-4">
              {methods.map((method) => (
                <button key={method} onClick={() => setSelectedMethod(method)} className={`rounded-lg border p-4 text-left font-semibold ${selectedMethod === method ? "border-2 border-amber-500 bg-amber-100" : "border-surface-200 bg-white"}`}>
                  <span className="mb-3 block h-8 rounded bg-surface-100 text-center font-mono text-mono-sm leading-8 text-surface-500">LOGO</span>
                  {method}
                </button>
              ))}
            </div>
            {selectedMethod ? <p className="text-surface-600">Secure payment processed by {selectedMethod}.</p> : null}
            <button onClick={completeRegistration} disabled={!selectedMethod} className="button primary">Continue to Payment</button>
          </div>
        ) : null}
        {error ? <p className="mx-auto mt-4 max-w-xl rounded-md bg-loss-bg p-3 text-sm text-loss-text">{error}</p> : null}
      </section>
    </main>
  );
}
