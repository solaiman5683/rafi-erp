import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { ArrowLeft, Check, Copy, ImageDown, Link2, Loader2, Printer, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QuoteView } from "@/components/QuoteView";
import { api, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { downloadAsImage, loadCurrentQuote, saveCurrentQuote, type QuoteDoc } from "@/lib/quote";

function Toolbar({ children }: { children: React.ReactNode }) {
  return <div className="no-print mx-auto mb-3 flex max-w-[640px] flex-wrap items-center gap-2 px-2">{children}</div>;
}

function useImageDownload(doc: QuoteDoc | null) {
  const { L } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  async function run() {
    if (!ref.current || !doc) return;
    setBusy(true);
    try {
      await downloadAsImage(ref.current, doc.no);
      toast.success(L("ছবি ডাউনলোড হয়েছে", "Image downloaded"));
    } catch {
      toast.error(L("ছবি বানানো গেল না, আবার চেষ্টা করুন", "Couldn't make the image, try again"));
    } finally {
      setBusy(false);
    }
  }
  return { ref, busy, run };
}

/** বিক্রির পাতা থেকে "কোটেশন" চেপে আসা পাতা — ছবি ডাউনলোড, লিংক শেয়ার, প্রিন্ট */
export function QuotePage() {
  const { L } = useI18n();
  const nav = useNavigate();
  const [state] = useState(loadCurrentQuote);
  const doc = state?.doc ?? null;
  const [sharedId, setSharedId] = useState<string | undefined>(state?.sharedId);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const img = useImageDownload(doc);
  const link = sharedId ? `${window.location.origin}/q/${sharedId}` : "";

  useEffect(() => {
    if (doc) document.title = `${L("কোটেশন", "Quotation")} ${doc.no}`;
  }, [doc, L]);

  if (!doc) {
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div className="grid gap-3">
          <p>{L("কোনো কোটেশন নেই — বিক্রির পাতা থেকে বানান", "No quotation — make one from the Sell page")}</p>
          <Button onClick={() => nav("/sell")}>{L("বিক্রির পাতায় যান", "Go to Sell")}</Button>
        </div>
      </div>
    );
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success(L("লিংক কপি হয়েছে", "Link copied"));
    } catch {
      toast.error(L("কপি হয়নি — লিংকটা চেপে ধরে কপি করুন", "Couldn't copy — long-press the link to copy"));
    }
  }

  /** প্রথমবার সার্ভারে সেভ হয়ে লিংক তৈরি হয়; এরপর একই লিংক */
  async function share() {
    let id = sharedId;
    if (!id) {
      setSharing(true);
      try {
        id = (await api<{ id: string }>("/quotes", { method: "POST", json: { doc } })).id;
        setSharedId(id);
        saveCurrentQuote(doc!, id);
      } catch (e) {
        toast.error(e instanceof ApiError && e.code === "network" ? L("লিংক বানাতে ইন্টারনেট লাগবে", "Internet is needed to make a link") : (e as Error).message);
        return;
      } finally {
        setSharing(false);
      }
    }
    const url = `${window.location.origin}/q/${id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${doc!.shop.name} — ${doc!.no}`, url });
        return;
      } catch {
        /* বাতিল করলে নিচে কপি অপশন থাকে */
      }
    }
    await copy(url);
  }

  return (
    <div className="min-h-dvh bg-slate-200 py-3 print:bg-white print:py-0">
      <Toolbar>
        <Button variant="outline" onClick={() => nav(-1)}>
          <ArrowLeft /> {L("ফিরে যান", "Back")}
        </Button>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer /> <span className="hidden sm:inline">{L("প্রিন্ট", "Print")}</span>
          </Button>
          <Button variant="outline" disabled={img.busy} onClick={() => void img.run()}>
            {img.busy ? <Loader2 className="animate-spin" /> : <ImageDown />} {L("ছবি", "Image")}
          </Button>
          <Button disabled={sharing} onClick={() => void share()}>
            {sharing ? <Loader2 className="animate-spin" /> : <Share2 />} {L("শেয়ার", "Share")}
          </Button>
        </div>
      </Toolbar>
      {link && (
        <Toolbar>
          <div className="flex w-full items-center gap-2 rounded-xl bg-white p-2 shadow-sm">
            <Link2 className="size-5 shrink-0 text-primary" />
            <Input readOnly value={link} className="h-9 flex-1 text-sm" onFocus={(e) => e.currentTarget.select()} />
            <Button size="sm" variant="outline" onClick={() => void copy(link)}>
              {copied ? <Check /> : <Copy />} {L("কপি", "Copy")}
            </Button>
          </div>
        </Toolbar>
      )}
      <div className="mx-2 shadow-xl sm:mx-auto sm:max-w-[640px] print:mx-0 print:shadow-none">
        <QuoteView ref={img.ref} doc={doc} />
      </div>
    </div>
  );
}

/** লিংক থেকে খোলা কোটেশন — লগইন লাগে না */
export function PublicQuotePage() {
  const { L } = useI18n();
  const { id } = useParams();
  const [doc, setDoc] = useState<QuoteDoc | null>(null);
  const [error, setError] = useState("");
  const img = useImageDownload(doc);

  useEffect(() => {
    void api<{ doc: QuoteDoc }>(`/public/quotes/${id}`)
      .then((r) => {
        setDoc(r.doc);
        document.title = `${r.doc.shop.name} — ${r.doc.no}`;
      })
      .catch((e: Error) => setError(e.message));
  }, [id]);

  if (error) return <div className="grid min-h-dvh place-items-center p-6 text-center text-lg">{error}</div>;
  if (!doc)
    return (
      <div className="grid min-h-dvh place-items-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <div className="min-h-dvh bg-slate-200 py-3 print:bg-white print:py-0">
      <Toolbar>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer /> {L("প্রিন্ট", "Print")}
          </Button>
          <Button disabled={img.busy} onClick={() => void img.run()}>
            {img.busy ? <Loader2 className="animate-spin" /> : <ImageDown />} {L("ছবি ডাউনলোড", "Download image")}
          </Button>
        </div>
      </Toolbar>
      <div className="mx-2 shadow-xl sm:mx-auto sm:max-w-[640px] print:mx-0 print:shadow-none">
        <QuoteView ref={img.ref} doc={doc} />
      </div>
    </div>
  );
}
