import FlagIcon from "@/components/entry/FlagIcon";
import { getTeamMetadata } from "@/lib/team-metadata";

type TeamBadgeProps = {
  teamCode: string;
  tone?: "light" | "gold" | "dark";
  compact?: boolean;
  align?: "left" | "right";
  subtitle?: string | null;
};

export default function TeamBadge({
  teamCode,
  tone = "light",
  compact = false,
  align = "left",
  subtitle = null,
}: TeamBadgeProps) {
  const metadata = getTeamMetadata(teamCode);

  const toneClass =
    tone === "gold"
      ? "border-amber-300/70 bg-[linear-gradient(135deg,#fff2bf,#f5c95e)] text-slate-950"
      : tone === "dark"
        ? "border-cyan-900/70 bg-[#0f2e3d] text-white"
        : "border-slate-200 bg-white text-slate-950";

  const justifyClass = align === "right" ? "justify-end text-right" : "justify-start text-left";
  const sizeClass = compact ? "gap-2 px-2.5 py-2" : "gap-3 px-3.5 py-3";
  const flagClass = compact ? "h-5 w-7" : "h-6 w-8";

  return (
    <div
      className={[
        "flex items-center rounded-2xl border shadow-[0_10px_24px_rgba(15,23,42,0.08)]",
        toneClass,
        sizeClass,
        justifyClass,
      ].join(" ")}
    >
      {align === "right" ? null : <FlagIcon teamCode={teamCode} className={flagClass} />}

      <div className="min-w-0">
        <div className={compact ? "text-sm font-semibold tracking-[0.08em]" : "text-sm font-semibold tracking-[0.12em]"}>
          {metadata.code}
        </div>
        {!compact && <div className="truncate text-[11px] opacity-70">{metadata.name}</div>}
        {compact && subtitle && <div className="text-[10px] uppercase opacity-60">{subtitle}</div>}
      </div>

      {align === "right" ? <FlagIcon teamCode={teamCode} className={flagClass} /> : null}
    </div>
  );
}
