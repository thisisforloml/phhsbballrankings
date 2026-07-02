"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { useAuth } from "@/components/auth/AuthContext";
import { BrandLogo } from "@/components/layout/BrandLogo";

const packages = [
  { name: "Standard", price: "PHP XXX per month", features: ["League details", "Verified game records"], action: "Select" },
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

  const inputClass = "min-h-11 w-full rounded-sm border border-line-500 bg-paper-500 px-3 py-2 text-court-900 outline-none transition focus:border-hardwood-600 focus:bg-white";

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
    router.push("/leagues");
  }

  return (
    <main className="min-h-screen bg-paper-500 px-5 pb-16 pt-32 text-court-900">
      <section className="mx-auto w-full max-w-4xl rounded-sm border border-line-500 bg-white p-6 shadow-panel">
        <BrandLogo href="" />
        <div className="mx-auto mt-8 flex max-w-xl items-center justify-center gap-3 font-mono text-mono-sm uppercase">
          {["Account", "Package", "Payment"].map((label, index) => (
            <span key={label} className={index + 1 === step ? "text-gold-500" : index + 1 < step ? "text-court-900" : "text-court-300"}>
              {label}
            </span>
          ))}
        </div>
        <h1 className="mt-8 text-center font-display text-stat-md text-court-900">Get Premium Access</h1>
        {step === 1 ? (
          <form onSubmit={submitAccount} className="mx-auto mt-6 grid max-w-xl gap-4">
            <label className="grid gap-2 text-sm font-semibold text-court-700">Full Name<input name="name" className={inputClass} required /></label>
            <label className="grid gap-2 text-sm font-semibold text-court-700">Email Address<input name="email" type="email" className={inputClass} required /></label>
            <label className="grid gap-2 text-sm font-semibold text-court-700">Organization Role<select name="role" className={inputClass}><option>Coach</option><option>Media</option><option>Scout</option><option>Analyst</option><option>Other</option></select></label>
            <label className="grid gap-2 text-sm font-semibold text-court-700">Country<input name="country" defaultValue="Philippines" className={inputClass} required /></label>
            <label className="grid gap-2 text-sm font-semibold text-court-700">Password<input name="password" type="password" className={inputClass} required /></label>
            <label className="grid gap-2 text-sm font-semibold text-court-700">Confirm Password<input name="confirmPassword" type="password" className={inputClass} required /></label>
            <button className="rounded-sm border border-hardwood-600 bg-hardwood-600 px-4 py-3 text-sm font-bold uppercase tracking-[0.04em] text-white hover:border-hardwood-700 hover:bg-hardwood-700" type="submit">Continue</button>
          </form>
        ) : null}
        {step === 2 ? (
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {packages.map((item) => (
              <button key={item.name} onClick={() => { setSelectedPackage(item.name); if (item.name !== "Institutional") setStep(3); }} className={`rounded-sm border p-5 text-left transition ${selectedPackage === item.name ? "border-2 border-hardwood-600 bg-paper-500" : "border-line-500 bg-white hover:border-hardwood-600"}`}>
                <h2 className="font-display text-3xl uppercase text-court-900">{item.name}</h2>
                <p className="mt-1 font-mono text-mono-sm uppercase text-court-500">{item.price}</p>
                <div className="mt-5 grid gap-2 text-sm text-court-600">
                  {item.features.map((feature) => <span key={feature}>{feature}</span>)}
                </div>
                {item.name === "Institutional" ? (
                  <p className="mt-4 text-sm leading-6 text-court-600">
                    Institutional subscribers receive API access for roster exports, board snapshots, and custom reporting pipelines.
                  </p>
                ) : null}
                <span className="mt-6 inline-flex font-semibold text-hardwood-600">{item.action}</span>
              </button>
            ))}
          </div>
        ) : null}
        {step === 3 ? (
          <div className="mx-auto mt-8 grid max-w-3xl gap-5">
            <div className="grid gap-3 md:grid-cols-4">
              {methods.map((method) => (
                <button key={method} onClick={() => setSelectedMethod(method)} className={`rounded-sm border p-4 text-left font-semibold ${selectedMethod === method ? "border-2 border-hardwood-600 bg-paper-500" : "border-line-500 bg-white"}`}>
                  <span className="mb-3 block h-8 rounded-sm bg-paper-500 text-center font-mono text-mono-sm leading-8 text-court-500">LOGO</span>
                  {method}
                </button>
              ))}
            </div>
            {selectedMethod ? <p className="text-court-600">Secure payment processed by {selectedMethod}.</p> : null}
            <button onClick={completeRegistration} disabled={!selectedMethod} className="rounded-sm border border-hardwood-600 bg-hardwood-600 px-4 py-3 text-sm font-bold uppercase tracking-[0.04em] text-white hover:border-hardwood-700 hover:bg-hardwood-700 disabled:opacity-50">Continue to Payment</button>
          </div>
        ) : null}
        {error ? <p className="mx-auto mt-4 max-w-xl rounded-sm bg-loss-bg p-3 text-sm text-loss-text">{error}</p> : null}
      </section>
    </main>
  );
}
