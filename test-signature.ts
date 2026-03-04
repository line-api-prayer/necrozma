import crypto from "crypto";

// Using the mock secret for local test
const secret = "2009193233"; 
const payload = JSON.stringify({ events: [] });

const signature = crypto
  .createHmac("sha256", secret)
  .update(payload, "utf8")
  .digest("base64");

console.log("PAYLOAD:", payload);
console.log("SIGNATURE:", signature);
