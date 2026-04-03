import type { FieldReportReadModel } from "./FieldReportReadModel";

export type RenderFieldReportInput = {
  readModel: FieldReportReadModel;
  dryRun?: boolean;
  brandLogoPngBytes?: Uint8Array;
};
