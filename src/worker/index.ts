import cron from "node-cron";
import { runScanCycle } from "@/core/orchestrator";

console.log("Hot Pulse worker started. Running on a 30 minute schedule.");

cron.schedule("*/30 * * * *", async () => {
  try {
    const result = await runScanCycle("scheduled");
    console.log(`[worker] scan completed`, result);
  } catch (error) {
    console.error("[worker] scan failed", error);
  }
});
