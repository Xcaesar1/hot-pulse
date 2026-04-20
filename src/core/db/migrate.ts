import { bootstrapDatabase } from "@/core/db/bootstrap";

void bootstrapDatabase().then(() => {
  console.log("Database bootstrap complete.");
});
