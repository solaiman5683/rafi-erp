import { useState } from "react";
import { toast } from "sonner";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { downloadCSV, type TableData } from "@/lib/tables";

/** প্রিন্ট (নতুন ট্যাবে, PDF হিসেবেও সেভ করা যায়) ও Excel/CSV ডাউনলোড */
export function ExportButtons({ build, printUrl, fileName }: { build: () => Promise<TableData>; printUrl: string; fileName: string }) {
  const { L } = useI18n();
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => window.open(`${printUrl}${printUrl.includes("?") ? "&" : "?"}auto=1`, "_blank")}>
        <Printer /> {L("প্রিন্ট", "Print")}
      </Button>
      <Button
        variant="outline"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            downloadCSV(fileName, await build());
          } catch (e) {
            toast.error((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Download /> {L("ডাউনলোড", "Download")}
      </Button>
    </>
  );
}
