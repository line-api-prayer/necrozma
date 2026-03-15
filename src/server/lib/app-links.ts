import { env } from "~/env.js";

function getAppBaseUrl() {
  return (
    env.BETTER_AUTH_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000")
  );
}

export function getStaffDashboardUrl(date?: string) {
  const url = new URL("/staff", getAppBaseUrl());
  if (date) {
    url.searchParams.set("date", date);
  }
  return url.toString();
}

export function getOrderDetailUrl(lineOrderNo: string) {
  return new URL(`/staff/order/${lineOrderNo}`, getAppBaseUrl()).toString();
}

export function getServiceRequestPageUrl(lineOrderNo: string, token: string) {
  const url = new URL(`/service-request/${lineOrderNo}`, getAppBaseUrl());
  url.searchParams.set("token", token);
  return url.toString();
}
