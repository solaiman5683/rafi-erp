import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import { registerSW } from "virtual:pwa-register";
import "./index.css";
import App from "./App";

// অফলাইনে অ্যাপ খোলার জন্য সার্ভিস ওয়ার্কার। নতুন ভার্সন এলে নিজে থেকে রিলোড না করে জিজ্ঞেস করে,
// যাতে বিক্রির মাঝখানে পেজ হঠাৎ বদলে না যায়।
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    toast("নতুন আপডেট এসেছে · New update available", {
      duration: Infinity,
      action: { label: "আপডেট করুন", onClick: () => void updateSW(true) },
    });
  },
  onOfflineReady() {
    toast.success("ইন্টারনেট ছাড়াও এখন অ্যাপ চলবে · Ready to work offline");
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
