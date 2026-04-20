import { runScanCycle } from "@/core/orchestrator";

void runScanCycle("manual")
  .then((result) => {
    console.log("Manual scan completed", result);
  })
  .catch((error) => {
    console.error("Manual scan failed", error);
    process.exitCode = 1;
  });
