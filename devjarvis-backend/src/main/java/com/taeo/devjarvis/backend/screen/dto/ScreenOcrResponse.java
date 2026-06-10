package com.taeo.devjarvis.backend.screen.dto;

import java.time.Instant;
import java.util.List;

public record ScreenOcrResponse(
        String requestId,
        String provider,
        String status,
        String text,
        boolean textFound,
        int textLength,
        String preview,
        int width,
        int height,
        String mimeType,
        int byteSize,
        List<String> warnings,
        Instant extractedAt
) {
}
