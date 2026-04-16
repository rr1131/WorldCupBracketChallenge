import { getFlagUrl, getTeamMetadata } from "@/lib/team-metadata";

type FlagIconProps = {
  teamCode: string;
  className?: string;
};

export default function FlagIcon({
  teamCode,
  className = "h-6 w-8",
}: FlagIconProps) {
  const metadata = getTeamMetadata(teamCode);

  return (
    <span
      className={`inline-flex overflow-hidden rounded-md border border-black/10 shadow-[0_4px_10px_rgba(15,23,42,0.12)] ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={getFlagUrl(teamCode)}
        alt={`${metadata.name} flag`}
        className="h-full w-full object-cover"
        loading="lazy"
      />
    </span>
  );
}
