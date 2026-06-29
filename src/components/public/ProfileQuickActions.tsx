"use client";

import { Share2 } from "lucide-react";

type ProfileShareButtonProps = {
  slug: string;
  displayName: string;
  className?: string;
  variant?: "circle" | "plain";
};

export function ProfileShareButton({
  slug,
  displayName,
  className = "",
  variant = "circle",
}: ProfileShareButtonProps) {
  async function shareProfile() {
    const url = `${window.location.origin}/players/${slug}`;
    if (navigator.share) {
      await navigator.share({ title: displayName, url });
      return;
    }
    await navigator.clipboard.writeText(url);
  }

  const variantClass =
    variant === "plain"
      ? "h-auto w-auto rounded-none border-0 bg-transparent p-0.5 text-court-600 hover:text-court-900"
      : "h-9 w-9 rounded-full border border-line-500 bg-white text-court-600 hover:border-court-900 hover:text-court-900";

  return (
    <button
      type="button"
      onClick={() => void shareProfile()}
      aria-label={`Share ${displayName} profile`}
      className={`inline-flex shrink-0 items-center justify-center transition ${variantClass} ${className}`}
    >
      <Share2 className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
