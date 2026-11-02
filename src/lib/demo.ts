import { db } from "./db";
import { saveCustomer, saveProduct, saveSupplier } from "./ops";

/** নবাবপুরের হার্ডওয়্যার দোকানের মতো কিছু নমুনা পণ্য — চেষ্টা করে দেখার জন্য */
export async function seedDemo() {
  const cats = await db.categories.toArray();
  const cat = (name: string) => cats.find((c) => c.name === name && !c.deleted)?.id;

  const items: { name: string; cat: string; brand?: string; unit: string; variants: [string, number, number, number?, number?][] }[] = [
    {
      name: "জিআই পাইপ",
      cat: "পাইপ ও ফিটিংস",
      brand: "ন্যাশনাল",
      unit: "feet",
      variants: [
        ['½"', 52, 60, 58, 400],
        ['¾"', 68, 78, 75, 300],
        ['1"', 95, 110, 105, 250],
        ['1½"', 150, 172, 165, 120],
      ],
    },
    {
      name: "পিভিসি এলবো",
      cat: "পাইপ ও ফিটিংস",
      brand: "আরএফএল",
      unit: "pcs",
      variants: [
        ['½"', 6, 10, 8, 500],
        ['¾"', 9, 14, 12, 400],
        ['1"', 14, 20, 18, 300],
      ],
    },
    {
      name: "বিবকক (পানির কল)",
      cat: "স্যানিটারি",
      brand: "স্টেলা",
      unit: "pcs",
      variants: [
        ["সাধারণ", 180, 250, 220, 40],
        ["স্টিল", 420, 550, 500, 15],
      ],
    },
    {
      name: "ইলেকট্রিক তার",
      cat: "ইলেকট্রিক্যাল",
      brand: "বিআরবি",
      unit: "coil",
      variants: [
        ["1.5 rm", 1850, 2150, 2050, 20],
        ["2.5 rm", 2900, 3350, 3200, 12],
      ],
    },
    { name: "সুইচ সকেট", cat: "ইলেকট্রিক্যাল", brand: "সুপারস্টার", unit: "pcs", variants: [["", 55, 80, 70, 150]] },
    {
      name: "স্টিল স্ক্রু",
      cat: "নাট-বল্টু-স্ক্রু",
      unit: "box",
      variants: [
        ['1"', 90, 130, 115, 60],
        ['1½"', 110, 160, 140, 45],
        ['2"', 140, 200, 180, 30],
      ],
    },
    { name: "তারকাটা", cat: "নাট-বল্টু-স্ক্রু", unit: "kg", variants: [['2"', 110, 135, 125, 80], ['3"', 105, 130, 120, 60]] },
    { name: "হাতুড়ি", cat: "টুলস ও যন্ত্রপাতি", brand: "টাটা", unit: "pcs", variants: [["", 320, 450, 400, 18]] },
    { name: "প্লাস", cat: "টুলস ও যন্ত্রপাতি", brand: "টাপারি", unit: "pcs", variants: [['8"', 280, 380, 340, 3]] },
    { name: "এনামেল রং", cat: "রং ও কেমিক্যাল", brand: "বার্জার", unit: "liter", variants: [["সাদা", 420, 520, 490, 24], ["কালো", 420, 520, 490, 2]] },
    { name: "পানির পাম্প", cat: "মোটর ও পাম্প", brand: "গাজী", unit: "pcs", variants: [["0.5 HP", 5200, 6500, 6200, 5], ["1 HP", 7800, 9500, 9000, 3]] },
    { name: "গোদরেজ তালা", cat: "তালা ও কব্জা", brand: "গোদরেজ", unit: "pcs", variants: [["ছোট", 260, 350, 320, 25], ["বড়", 480, 620, 580, 10]] },
  ];

  for (const it of items) {
    await saveProduct(
      { name: it.name, category_id: cat(it.cat), brand: it.brand, unit: it.unit },
      it.variants.map(([name, buy, sell, wholesale, opening]) => ({
        name,
        buy_price: buy,
        sell_price: sell,
        wholesale_price: wholesale,
        opening,
        low_stock: Math.max(2, Math.round((opening ?? 10) * 0.1)),
      })),
    );
  }
  await saveCustomer({ name: "করিম কন্ট্রাক্টর", phone: "01711000000", type: "contractor", price_tier: "wholesale", disc_mode: "percent", disc_value: 3, address: "যাত্রাবাড়ী" }, 4500);
  await saveCustomer({ name: "রহিম মিস্ত্রি", phone: "01822000000", type: "mistri", price_tier: "retail", disc_mode: "amount", disc_value: 50 });
  await saveSupplier({ name: "আল-আমিন ট্রেডার্স", company: "নবাবপুর রোড", phone: "01933000000" }, 25000);
}
