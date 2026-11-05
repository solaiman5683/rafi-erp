import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Search, Smile, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ICON_LIST, NamedIcon } from "@/components/Icon";
import { useI18n } from "@/lib/i18n";
import { matchesText, normalize } from "@/lib/search";
import { cn } from "@/lib/utils";

/** আপলোড করা ছবি ছোট করে (৯৬px) সেভ — সিঙ্কে কম জায়গা নেয় */
function shrinkImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const size = 96;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("canvas"));
      const scale = Math.min(size / img.width, size / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      URL.revokeObjectURL(url);
      const webp = canvas.toDataURL("image/webp", 0.85);
      resolve(webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png"));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image"));
    };
    img.src = url;
  });
}

/** বড় আইকন তালিকা (খোঁজা যায়) + নিজের ইমোজি বা ছবি */
export function IconPicker({ value, onChange, color }: { value?: string; onChange: (icon: string) => void; color?: string }) {
  const { L } = useI18n();
  const [q, setQ] = useState("");
  const [emoji, setEmoji] = useState(value?.startsWith("emoji:") ? value.slice(6) : "");
  const fileRef = useRef<HTMLInputElement>(null);
  const list = useMemo(() => {
    const t = normalize(q);
    if (!t) return ICON_LIST;
    // পুরো শব্দ মিললে আগে, তারপর শুরুর অংশ; কিছুই না মিললে তবেই বানান-ভুল/উচ্চারণে খোঁজা
    const scored = ICON_LIST.map((i) => {
      const words = normalize(`${i.name} ${i.keywords}`).split(" ");
      const s = words.includes(t) ? 3 : words.some((w) => w.startsWith(t)) ? 2 : 0;
      return { i, s };
    })
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.i);
    return scored.length ? scored : ICON_LIST.filter((i) => matchesText(`${i.name} ${i.keywords}`, q));
  }, [q]);
  const custom = value?.startsWith("emoji:") || value?.startsWith("img:");

  const tile = (on: boolean) => cn("grid size-10 place-items-center rounded-lg border-2 transition", on ? "border-primary bg-primary/10" : "bg-white hover:border-primary/50");

  return (
    <div className="grid gap-2.5">
      <div className="relative">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} className="h-10 pl-8" placeholder={L("আইকন খুঁজুন — যেমন: পানি, বিল, tea", "Search icons — e.g. water, bill, tea")} />
        {q && (
          <button type="button" onClick={() => setQ("")} className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground" aria-label="clear">
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* ছোট নির্দিষ্ট মাপের ঘর — যত চওড়া জায়গা, এক সারিতে তত বেশি আইকন */}
      <div className="grid max-h-52 grid-cols-[repeat(auto-fill,2.5rem)] justify-between gap-1.5 overflow-y-auto pr-1">
        {list.map((ic) => (
          <button key={ic.name} type="button" title={ic.keywords} onClick={() => onChange(ic.name)} className={tile(value === ic.name)}>
            <NamedIcon name={ic.name} className="size-5" style={{ color }} />
          </button>
        ))}
        {list.length === 0 && <p className="col-span-full py-4 text-center text-sm text-muted-foreground">{L("এই নামে আইকন নেই — নিচে নিজের ইমোজি বা ছবি দিন", "No icon found — use your own emoji or picture below")}</p>}
      </div>

      {/* নিজের আইকন */}
      <div className="grid gap-2 rounded-xl border-2 border-dashed p-2.5">
        <p className="text-sm font-semibold text-muted-foreground">{L("নিজের আইকন", "Your own icon")}</p>
        <div className="flex flex-wrap items-center gap-2">
          {custom && (
            <span className={tile(true)}>
              <NamedIcon name={value} className="size-6" style={{ color }} />
            </span>
          )}
          <div className="relative w-36">
            <Smile className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={emoji}
              maxLength={8}
              className="h-10 pl-8 text-lg"
              placeholder={L("ইমোজি", "Emoji")}
              onChange={(e) => {
                const v = e.target.value.trim();
                setEmoji(v);
                if (v) onChange(`emoji:${[...v].slice(0, 2).join("")}`);
              }}
            />
          </div>
          <Button type="button" variant="outline" className="h-10" onClick={() => fileRef.current?.click()}>
            <ImagePlus /> {L("ছবি দিন", "Upload picture")}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try {
                onChange(`img:${await shrinkImage(f)}`);
                setEmoji("");
              } catch {
                toast.error(L("ছবিটা খোলা গেল না", "Couldn't open that picture"));
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
