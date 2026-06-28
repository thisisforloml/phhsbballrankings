type PortraitAvatarProps = {
  photoUrl?: string | null;
  name: string;
  className?: string;
};

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function PortraitAvatar({ photoUrl, name, className = "" }: PortraitAvatarProps) {
  return (
    <span
      className={`relative block aspect-[2/3] w-12 overflow-hidden border border-court-900 bg-court-900 ${className}`}
    >
      {photoUrl ? (
        <img src={photoUrl} alt="" className="absolute inset-x-0 bottom-0 h-full w-full object-contain object-bottom" />
      ) : (
        <span className="absolute inset-0 grid place-items-center text-sm font-black text-gold-500">{initials(name)}</span>
      )}
    </span>
  );
}
