package com.taeo.devjarvis.backend.ai.dto.ocr;

import java.util.List;

public record AiServerOcrResponse(
        String requestId,
        String provider,
        String status,
        String text,
        boolean textFound,
        String language,
        Double confidence,
        List<AiServerOcrTextBlock> blocks,
        AiServerOcrImageResponse image,
        List<String> warnings,
        long elapsedMillis
) {
}
