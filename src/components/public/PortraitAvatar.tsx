type PortraitAvatarProps = {
  photoUrl?: string | null;
  name: string;
  className?: string;
  variant?: "default" | "scout";
};

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function PortraitAvatar({ photoUrl, name, className = "", variant = "default" }: PortraitAvatarProps) {
  const shellClass =
    variant === "scout"
      ? "prospect-portrait-frame relative block aspect-[2/3] w-12 overflow-hidden rounded-sm border border-white/10"
      : "prospect-portrait-frame relative block aspect-[2/3] w-12 overflow-hidden rounded-sm border border-line-500";
  const initialsClass = variant === "scout" ? "text-sm font-black text-scout-orange-bright" : "text-sm font-black text-gold-500";

  return (
    <span className={`${shellClass} ${className}`}>
      {photoUrl ? (
        <img src={photoUrl} alt="" className="absolute inset-x-0 bottom-0 h-full w-full object-contain object-bottom" />
      ) : (
        <span className={`absolute inset-0 grid place-items-center ${initialsClass}`}>{initials(name)}</span>
      )}
    </span>
  );
}
