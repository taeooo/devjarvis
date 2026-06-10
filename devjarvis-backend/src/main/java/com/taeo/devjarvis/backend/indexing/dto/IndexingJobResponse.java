package com.taeo.devjarvis.backend.indexing.dto;

import com.taeo.devjarvis.backend.indexing.domain.IndexingJob;
import com.taeo.devjarvis.backend.indexing.domain.IndexingJobStatus;

import java.time.OffsetDateTime;

public record IndexingJobResponse(
        Long id,
        Long projectId,
        IndexingJobStatus status,
        int requestedFileCount,
        int targetFileCount,
        int processedFileCount,
        int failedFileCount,
        int totalChunkCount,
        String errorMessage,
        OffsetDateTime startedAt,
        OffsetDateTime finishedAt,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
    public static IndexingJobResponse from(IndexingJob indexingJob) {
        return new IndexingJobResponse(
                indexingJob.getId(),
                indexingJob.getProjectId(),
                indexingJob.getStatus(),
                indexingJob.getRequestedFileCount(),
                indexingJob.getTargetFileCount(),
                indexingJob.getProcessedFileCount(),
                indexingJob.getFailedFileCount(),
                indexingJob.getTotalChunkCount(),
                indexingJob.getErrorMessage(),
                indexingJob.getStartedAt(),
                indexingJob.getFinishedAt(),
                indexingJob.getCreatedAt(),
                indexingJob.getUpdatedAt()
        );
    }
}
