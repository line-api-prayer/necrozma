import {
  generateCertificatePdfBuffer,
  generatePdfBuffer,
} from "../../src/server/lib/report-generator";
import fs from 'fs';
import path from "path";

const dummyData = {
  date: '2026-03-04',
  orders: [
    {
      id: 'test-1',
      lineOrderNo: 'ORD-123',
      customerName: 'Test User 1',
      totalPrice: 1532,
      internalStatus: 'PENDING',
      orderDate: '2026-03-04',
      items: [
        {
          id: 'item-1',
          orderId: 'test-1',
          name: 'ตักบาตร ชุด S',
          sku: 'PKG-S',
          quantity: 4,
          price: 100,
          originalPrice: 100
        }
      ],
      evidence: []
    },
    {
      id: 'test-2',
      lineOrderNo: 'ORD-124',
      customerName: 'Test User 2',
      totalPrice: 400,
      internalStatus: 'PENDING',
      orderDate: '2026-03-04',
      items: [
        {
          id: 'item-2',
          orderId: 'test-2',
          name: 'ชุดตักบาตรเพื่อสุขภาพ',
          sku: 'PKG-H',
          quantity: 1,
          price: 400,
          originalPrice: 400
        },
        {
          id: 'item-3',
          orderId: 'test-2',
          name: 'แก้บน ชุดใหญ่',
          sku: 'PKG-GB-L',
          quantity: 2,
          price: 200,
          originalPrice: 200
        }
      ],
      evidence: []
    }
  ],
  totalRevenue: 1932,
  pendingCount: 2,
  uploadedCount: 0,
  completedCount: 0
};

async function test() {
  try {
    const outputDir = path.resolve(process.cwd(), "scripts/diagnostics/output");
    fs.mkdirSync(outputDir, { recursive: true });

    const buffer = await generatePdfBuffer(dummyData as any);
    const certificateBuffer = await generateCertificatePdfBuffer(dummyData as any);
    const summaryPath = path.join(outputDir, "test-output.pdf");
    const certificatePath = path.join(outputDir, "test-certificates.pdf");

    fs.writeFileSync(summaryPath, buffer);
    fs.writeFileSync(certificatePath, certificateBuffer);
    console.log(
      `PDFs generated successfully, saved to ${summaryPath} and ${certificatePath}`,
    );
  } catch (err) {
    console.error('Error generating PDF:', err);
  }
}

test();
