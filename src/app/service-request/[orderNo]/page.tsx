import { supabaseClient } from "~/server/db/supabase";
import { verifyServiceRequestToken } from "~/server/lib/service-request";
import { ServiceRequestForm } from "./service-request-form";
import styles from "./page.module.css";

type SearchParams = Promise<{ token?: string | string[] }>;
type Params = Promise<{ orderNo: string }>;
type ServiceRequestOrderRow = {
  line_order_no: string;
  customer_name: string;
  requested_service_date: string | null;
  prayer_text: string | null;
  internal_status: string;
  order_items: { name: string; quantity: number }[] | null;
};

function normalizeToken(token: string | string[] | undefined) {
  return Array.isArray(token) ? token[0] : token;
}

export default async function ServiceRequestPage(props: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { orderNo } = await props.params;
  const searchParams = await props.searchParams;
  const token = normalizeToken(searchParams.token);

  if (!verifyServiceRequestToken(orderNo, token)) {
    return (
      <div className={styles.page}>
        <section className={styles.invalidCard}>
          <p className={styles.eyebrow}>Invalid Link</p>
          <h1 className={styles.title}>ลิงก์นี้ไม่ถูกต้องหรือหมดอายุ</h1>
          <p className={styles.subtitle}>รบกวนขอรับลิงก์ใหม่จาก LINE OA แล้วลองเปิดอีกครั้งนะคะ</p>
        </section>
      </div>
    );
  }

  const safeToken = token!;

  const supabase = await supabaseClient();
  const { data, error } = await supabase
    .from("orders")
    .select("line_order_no, customer_name, requested_service_date, prayer_text, internal_status, order_items(name, quantity)")
    .eq("line_order_no", orderNo)
    .single();

  const order = data as ServiceRequestOrderRow | null;

  if (error || !order) {
    return (
      <div className={styles.page}>
        <section className={styles.invalidCard}>
          <p className={styles.eyebrow}>Order Missing</p>
          <h1 className={styles.title}>ไม่พบคำสั่งซื้อ</h1>
          <p className={styles.subtitle}>รบกวนตรวจสอบลิงก์อีกครั้ง หรือติดต่อเจ้าหน้าที่เพื่อช่วยตรวจสอบให้นะคะ</p>
        </section>
      </div>
    );
  }

  const packageSummary =
    order.order_items && order.order_items.length > 0
      ? order.order_items
          .map((item) => `${item.name} x${item.quantity}`)
          .join(", ")
      : "-";

  return (
    <div className={styles.page}>
      <ServiceRequestForm
        orderNo={order.line_order_no}
        token={safeToken}
        customerName={order.customer_name}
        packageSummary={packageSummary}
        requestedServiceDate={order.requested_service_date}
        prayerText={order.prayer_text}
        isLocked={order.internal_status !== "PENDING"}
      />
    </div>
  );
}
