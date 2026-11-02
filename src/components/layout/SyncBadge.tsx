import { CloudCheck, CloudOff, RefreshCw, TriangleAlert } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePendingCount } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";
import { syncNow, useSyncState } from "@/lib/sync";
import { cn } from "@/lib/utils";

/** উপরের কোণায় সিঙ্কের অবস্থা: সবুজ = সব সেভ, কমলা = অফলাইন, লাল = সমস্যা */
export function SyncBadge({ full }: { full?: boolean }) {
  const { L, num, time } = useI18n();
  const s = useSyncState();
  const pending = usePendingCount();

  let Icon = CloudCheck;
  let tone = "bg-emerald-50 text-emerald-700 ring-emerald-200";
  let text = L("সব সেভ হয়েছে", "All saved");
  if (s.phase === "syncing") {
    Icon = RefreshCw;
    tone = "bg-sky-50 text-sky-700 ring-sky-200";
    text = L("সিঙ্ক হচ্ছে…", "Syncing…");
  } else if (!s.online || s.phase === "offline") {
    Icon = CloudOff;
    tone = "bg-amber-50 text-amber-800 ring-amber-200";
    text = pending ? L(`অফলাইন · ${num(pending)}টি অপেক্ষায়`, `Offline · ${num(pending)} waiting`) : L("অফলাইন", "Offline");
  } else if (s.phase === "error") {
    Icon = TriangleAlert;
    tone = "bg-red-50 text-red-700 ring-red-200";
    text = L("সিঙ্ক সমস্যা", "Sync problem");
  } else if (pending) {
    Icon = RefreshCw;
    tone = "bg-sky-50 text-sky-700 ring-sky-200";
    text = L(`${num(pending)}টি পাঠানো বাকি`, `${num(pending)} to send`);
  }

  const tip =
    (s.lastSync ? L(`শেষ সিঙ্ক: ${time(s.lastSync)}`, `Last sync: ${time(s.lastSync)}`) : L("এখনো সিঙ্ক হয়নি", "Not synced yet")) +
    (s.error && s.phase === "error" ? ` — ${s.error}` : "") +
    " · " +
    L("ডাটা এই ডিভাইসে নিরাপদে জমা আছে", "Data is safely stored on this device");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => void syncNow()}
          className={cn("inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold ring-1", tone)}
        >
          <Icon className={cn("size-4", s.phase === "syncing" && "animate-spin")} />
          <span className={cn(!full && "hidden sm:inline")}>{text}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-sm">{tip}</TooltipContent>
    </Tooltip>
  );
}
