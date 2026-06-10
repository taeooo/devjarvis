package com.taeo.devjarvis.backend.common.api;

public record ApiError(
        String code,
        String message
) {
}
