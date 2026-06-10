package com.taeo.devjarvis.backend.screen.dto;

import java.time.Instant;
import java.util.List;

public record ScreenAnalysisResponse(
        String requestId,
        String provider,
        String status,
        String intent,
        String title,
        String summary,
        String detail,
        String preview,
        List<String> actionItems,
        int textUsedLength,
        List<String> warnings,
        Instant analyzedAt
) {
}
