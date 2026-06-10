package com.taeo.devjarvis.backend.ai.dto.analysis;

public record AiServerScreenAnalysisRequest(
        String requestId,
        String commandId,
        String intent,
        String contextMode,
        String ocrProvider,
        String ocrText,
        boolean ocrTextFound,
        int width,
        int height,
        String capturedAt
) {
}
