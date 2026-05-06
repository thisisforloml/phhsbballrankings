"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { useEffect } from "react";

export default function SubmitPlayerInfoPage() {
  const [message, setMessage] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");

  useEffect(() => {
    const name = new URLSearchParams(window.location.search).get("player") ?? "";
    setPlayerName(name);
    setFirstName(name.split(" ")[0] ?? "");
    setLastName(name.split(" ").slice(1).join(" "));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Submitting request...");
    const form = new FormData(event.currentTarget);
    form.set("photoUrl", photoUrl);
    const response = await fetch("/api/player-submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form))
    });
    const result = (await response.json()) as { ok: boolean; message?: string };
    setMessage(result.ok ? "Submitted. The administrator will review this request." : result.message ?? "Submission failed.");
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setPhotoUrl("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhotoUrl(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  }

  return (
    <main className="section page-shell">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Player request</p>
          <h1>Submit profile info</h1>
        </div>
        <p>Players can submit information, but only the administrator can edit verified OnCourt profiles.</p>
      </div>
      <form className="login-panel request-form" onSubmit={handleSubmit}>
        <input type="hidden" name="playerName" value={playerName} />
        <div className="form-grid two">
          <label>First name<input name="firstName" value={firstName} onChange={(event) => setFirstName(event.target.value)} required /></label>
          <label>Last name<input name="lastName" value={lastName} onChange={(event) => setLastName(event.target.value)} required /></label>
        </div>
        <div className="form-grid three">
          <label>Position<input name="position" placeholder="PG, SG, SF, PF, C" /></label>
          <label>Height (cm)<input name="heightCm" type="number" min="0" /></label>
          <label>Contact<input name="contact" placeholder="Email or phone" required /></label>
        </div>
        <div className="form-grid two">
          <label>Region<input name="region" /></label>
          <label>City<input name="city" /></label>
        </div>
        <label>
          Profile picture
          <input type="file" accept="image/*" onChange={handlePhotoChange} />
        </label>
        {photoUrl ? <img className="submission-preview" src={photoUrl} alt="Profile preview" /> : null}
        <label>Message<textarea name="message" placeholder="Tell the administrator what should be added or corrected." /></label>
        <button className="button primary" type="submit">Submit request</button>
        {message ? <p className="form-message">{message}</p> : null}
      </form>
    </main>
  );
}
