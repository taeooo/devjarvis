export type ManifestFile = {
  relativePath: string;
  fileName: string;
  extension: string;
  language: string;
  sizeBytes: number;
  sha256: string | null;
  excluded: boolean;
  excludedReason: string | null;
};

export type ScanSummary = {
  requestedFileCount: number;
  targetFileCount: number;
  excludedFileCount: number;
  sensitiveFileCount: number;
  largeFileCount: number;
  generatedOrToolingFileCount: number;
};

export type ProjectScanResult = {
  rootName: string;
  rootPathAlias: string;
  files: ManifestFile[];
  summary: ScanSummary;
};

export type ApiResponse<T> = {
  success: boolean;
  data: T | null;
  error: {
    code: string;
    message: string;
  } | null;
  timestamp: string;
};

export type ProjectResponse = {
  id: number;
  name: string;
  rootPathAlias: string | null;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type ManifestRegisterResponse = {
  projectId: number;
  requestedFileCount: number;
  targetFileCount: number;
  excludedFileCount: number;
};

export type ProjectFileReadItem = {
  relativePath: string;
  fileName: string;
  extension: string;
  language: string;
  sizeBytes: number;
  truncated: boolean;
  content: string;
};

export type ProjectFileReadRejectedItem = {
  relativePath: string;
  reason: string;
};

export type ProjectFileReadResult = {
  files: ProjectFileReadItem[];
  rejected: ProjectFileReadRejectedItem[];
  totalBytes: number;
  maxFileBytes: number;
  maxTotalBytes: number;
};
