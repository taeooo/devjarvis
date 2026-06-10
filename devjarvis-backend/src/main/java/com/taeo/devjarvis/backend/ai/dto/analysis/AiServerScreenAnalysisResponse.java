package com.taeo.devjarvis.backend.ai.dto.analysis;

import java.util.List;

public record AiServerScreenAnalysisResponse(
        String requestId,
        String provider,
        String status,
        String intent,
        String title,
        String summary,
        String detail,
        List<String> actionItems,
        int textUsedLength,
        List<String> warnings,
        long elapsedMillis
) {
}
