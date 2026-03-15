"use server";

import { z } from "zod";
import { supabaseClient } from "~/server/db/supabase";
import { verifyServiceRequestToken } from "~/server/lib/service-request";

export type ServiceRequestFormState = {
  status: "idle" | "success" | "error";
  message: string;
};

const initialSchema = z.object({
  orderNo: z.string().min(1),
  token: z.string().min(1),
  requestedServiceDate: z.string().min(1, "รบกวนเลือกวันดำเนินงานด้วยนะคะ"),
  prayerText: z.string().trim().min(1, "รบกวนกรอกคำขอพรด้วยนะคะ").max(2000, "คำขอพรยาวเกินไปเล็กน้อย รบกวนย่อให้อีกนิดนะคะ"),
});

export async function submitServiceRequest(
  _prevState: ServiceRequestFormState,
  formData: FormData,
): Promise<ServiceRequestFormState> {
  const parsed = initialSchema.safeParse({
    orderNo: formData.get("orderNo"),
    token: formData.get("token"),
    requestedServiceDate: formData.get("requestedServiceDate"),
    prayerText: formData.get("prayerText"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง",
    };
  }

  const { orderNo, token, requestedServiceDate, prayerText } = parsed.data;

  if (!verifyServiceRequestToken(orderNo, token)) {
    return {
      status: "error",
      message: "ลิงก์นี้ไม่ถูกต้องหรือหมดอายุแล้ว รบกวนขอรับลิงก์ใหม่อีกครั้งนะคะ",
    };
  }

  const supabase = await supabaseClient();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, internal_status")
    .eq("line_order_no", orderNo)
    .single();

  if (orderError || !order) {
    return {
      status: "error",
      message: "ไม่พบคำสั่งซื้อที่ต้องการอัปเดตค่ะ รบกวนติดต่อเจ้าหน้าที่เพื่อตรวจสอบให้นะคะ",
    };
  }

  if (order.internal_status !== "PENDING") {
    return {
      status: "error",
      message: "คำสั่งซื้อนี้อยู่ในขั้นตอนดำเนินงานแล้ว จึงยังไม่สามารถแก้ไขข้อมูลได้ค่ะ หากต้องการความช่วยเหลือ รบกวนติดต่อเจ้าหน้าที่นะคะ",
    };
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      requested_service_date: requestedServiceDate,
      prayer_text: prayerText.trim(),
      service_request_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id);

  if (updateError) {
    return {
      status: "error",
      message: updateError.message,
    };
  }

  return {
    status: "success",
    message: "บันทึกวันดำเนินงานและคำขอพรเรียบร้อยแล้วค่ะ ขอบคุณมากนะคะ",
  };
}
