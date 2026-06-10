package com.taeo.devjarvis.backend.ai.dto;

public record AiApiResponse<T>(
        boolean success,
        T data,
        AiApiError error,
        String timestamp
) {
}
