"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const outputWidth = 1000;
const outputHeight = 1500;

function outputType(file: File | null) {
  if (!file) return "image/png";
  if (file.type === "image/png") return "image/png";
  if (file.type === "image/webp") return "image/webp";
  return "image/jpeg";
}

function outputExtension(type: string) {
  if (type === "image/webp") return "webp";
  if (type === "image/jpeg") return "jpg";
  return "png";
}

function fileBaseName(name: string) {
  return name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "player-photo";
}

type PlayerPhotoCropperProps = {
  currentPhotoUrl: string | null;
};

export function PlayerPhotoCropper({ currentPhotoUrl }: PlayerPhotoCropperProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hiddenFileRef = useRef<HTMLInputElement>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [previewUrl, setPreviewUrl] = useState("");
  const [status, setStatus] = useState("");

  const outputDescription = useMemo(() => {
    const type = outputType(sourceFile);
    if (type === "image/png") return "Cropped PNG, 1000 x 1500 px. Transparency is preserved for transparent PNG uploads.";
    if (type === "image/webp") return "Cropped WEBP, 1000 x 1500 px.";
    return "Cropped JPG, 1000 x 1500 px.";
  }, [sourceFile]);

  useEffect(() => {
    return () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl, sourceUrl]);

  useEffect(() => {
    if (!sourceFile || !sourceUrl) return;
    let cancelled = false;
    const file = sourceFile;

    async function crop() {
      const image = new Image();
      image.decoding = "async";
      image.src = sourceUrl;
      await image.decode();
      if (cancelled) return;

      const canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const context = canvas.getContext("2d");
      if (!context) return;

      context.clearRect(0, 0, outputWidth, outputHeight);
      const baseScale = Math.max(outputWidth / image.naturalWidth, outputHeight / image.naturalHeight);
      const scale = baseScale * zoom;
      const drawWidth = image.naturalWidth * scale;
      const drawHeight = image.naturalHeight * scale;
      const drawX = (outputWidth - drawWidth) / 2 + offsetX;
      const drawY = (outputHeight - drawHeight) / 2 + offsetY;
      context.drawImage(image, drawX, drawY, drawWidth, drawHeight);

      const type = outputType(file);
      const quality = type === "image/jpeg" || type === "image/webp" ? 0.9 : undefined;
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
      if (!blob || cancelled) return;

      const croppedFile = new File([blob], `${fileBaseName(file.name)}-profile-crop.${outputExtension(type)}`, { type });
      const transfer = new DataTransfer();
      transfer.items.add(croppedFile);
      if (hiddenFileRef.current) hiddenFileRef.current.files = transfer.files;

      setPreviewUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return URL.createObjectURL(blob);
      });
      setStatus(`${Math.round(blob.size / 1024)} KB ready for upload. ${outputDescription}`);
    }

    crop().catch(() => setStatus("Could not crop this image. Try a JPG, PNG, or WEBP file."));
    return () => {
      cancelled = true;
    };
  }, [offsetX, offsetY, outputDescription, sourceFile, sourceUrl, zoom]);

  function selectFile(file: File | null) {
    setStatus("");
    setZoom(1);
    setOffsetX(0);
    setOffsetY(0);
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    if (!file) {
      setSourceFile(null);
      setSourceUrl("");
      if (hiddenFileRef.current) hiddenFileRef.current.value = "";
      return;
    }
    setSourceFile(file);
    setSourceUrl(URL.createObjectURL(file));
  }

  function resetCrop() {
    setZoom(1);
    setOffsetX(0);
    setOffsetY(0);
  }

  function cancelCrop() {
    if (fileInputRef.current) fileInputRef.current.value = "";
    selectFile(null);
  }

  return (
    <div className="grid gap-3 rounded-md border border-surface-200 p-3">
      <span className="text-sm font-semibold text-ink-700">Crop profile image</span>
      <input ref={hiddenFileRef} name="photoFile" type="file" className="hidden" tabIndex={-1} />
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => selectFile(event.target.files?.[0] ?? null)} className="rounded-md border border-surface-300 px-3 py-2 text-sm" />
      <div className="grid gap-4 md:grid-cols-[13rem_1fr]">
        <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-[linear-gradient(135deg,#fb923c_0%,#f97316_48%,#c2410c_100%)]">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.18)_1px,transparent_1px)] bg-[size:20px_20px] opacity-60" aria-hidden="true" />
          {previewUrl ? (
            <img src={previewUrl} alt="" className="absolute inset-0 h-full w-full object-contain object-bottom" />
          ) : currentPhotoUrl ? (
            <img src={currentPhotoUrl} alt="" className="absolute inset-0 h-full w-full object-contain object-bottom" />
          ) : (
            <span className="absolute inset-0 grid place-items-center px-4 text-center text-xs font-bold uppercase tracking-[0.08em] text-white/80">No photo</span>
          )}
        </div>
        <div className="grid content-start gap-3">
          <p className="text-xs text-ink-500">Use a portrait crop for the public orange player panel. Best as a transparent PNG cutout.</p>
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.06em] text-ink-500">Zoom<input type="range" min="0.8" max="2.4" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} disabled={!sourceFile} /></label>
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.06em] text-ink-500">Horizontal position<input type="range" min="-400" max="400" step="1" value={offsetX} onChange={(event) => setOffsetX(Number(event.target.value))} disabled={!sourceFile} /></label>
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.06em] text-ink-500">Vertical position<input type="range" min="-500" max="500" step="1" value={offsetY} onChange={(event) => setOffsetY(Number(event.target.value))} disabled={!sourceFile} /></label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={resetCrop} disabled={!sourceFile} className="rounded-md border border-surface-300 px-3 py-2 text-xs font-semibold text-ink-700 disabled:opacity-50">Reset crop</button>
            <button type="button" onClick={cancelCrop} disabled={!sourceFile} className="rounded-md border border-surface-300 px-3 py-2 text-xs font-semibold text-ink-700 disabled:opacity-50">Cancel image</button>
          </div>
          <p className="text-xs text-ink-500">{status || "Output target: 1000 x 1500 px, 2:3 portrait."}</p>
        </div>
      </div>
    </div>
  );
}
