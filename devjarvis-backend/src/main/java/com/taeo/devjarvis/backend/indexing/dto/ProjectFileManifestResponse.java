package com.taeo.devjarvis.backend.indexing.dto;

public record ProjectFileManifestResponse(
        Long projectId,
        int requestedFileCount,
        int upsertedFileCount,
        int targetFileCount,
        int excludedFileCount
) {
}
