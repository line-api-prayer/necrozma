import { spec } from "~/lib/swagger";
import SwaggerUIComponent from "./_components/SwaggerUI";

export const metadata = {
  title: "API Documentation | Necrozma",
};

export default function ApiDocsPage() {
  return (
    <div style={{ backgroundColor: "white", minHeight: "100vh" }}>
      <SwaggerUIComponent spec={spec} />
    </div>
  );
}
