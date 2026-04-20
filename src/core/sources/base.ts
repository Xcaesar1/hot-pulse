import type { CandidateDocument, MonitorRecord, SourceRecord } from "@/core/contracts";

export interface SourceFetchContext {
  monitor: MonitorRecord;
  source: SourceRecord;
}

export interface SourceAdapter {
  key: string;
  fetch(context: SourceFetchContext): Promise<CandidateDocument[]>;
}
