import type { VehicleDocument } from '@/api/types';

// Uploading a replacement inserts a new row rather than overwriting the old
// one — the backend keeps the history, which is right for an audit trail but
// means a vehicle can hold several documents of the same type.
//
// Every screen therefore has to pick the newest per type. Taking the first
// match instead (the obvious `.find()`) shows the *oldest* upload, so a driver
// who replaced a rejected RC would still see the rejected one, and a reviewer
// would judge the vehicle on a superseded document.
export function latestDocumentsByType(documents: VehicleDocument[] = []): VehicleDocument[] {
  const newestByType = new Map<string, VehicleDocument>();

  for (const document of documents) {
    const current = newestByType.get(document.documentType);
    if (
      current === undefined ||
      new Date(document.createdAt).getTime() > new Date(current.createdAt).getTime()
    ) {
      newestByType.set(document.documentType, document);
    }
  }

  return [...newestByType.values()];
}

export function latestDocumentOfType(
  documents: VehicleDocument[] = [],
  documentType: string,
): VehicleDocument | undefined {
  return latestDocumentsByType(documents).find(
    (document) => document.documentType === documentType,
  );
}
