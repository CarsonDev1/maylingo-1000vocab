import { getServiceClient } from "./_supabase.mjs";
const db = getServiceClient();

let r = await db.from("courses").select("*");
console.log("SELECT * courses:", JSON.stringify({ status: r.status, count: r.count, error: r.error, data: r.data }));

r = await db.from("courses").insert({ id: 1, title_vi: "1000 Từ Cơ Bản", title_en: "1000 Basic Words" });
console.log("INSERT courses:", JSON.stringify({ status: r.status, error: r.error }));

r = await db.from("courses").select("*");
console.log("SELECT after insert:", JSON.stringify({ count: r.count, data: r.data, error: r.error }));
