-- শেয়ার করা কোটেশন: লিংক জানা যে কেউ দেখতে পারে (লগইন ছাড়া), তাই id অনুমান করা যায় না এমন UUID
CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  created_by TEXT
);
