import { config } from "dotenv";
config({ path: ".env.development.local" });

async function run() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/orders?line_order_no=eq.2026030380252885&select=*,order_items(*)`, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    }
  });
  console.log(await res.json());
}
run();
