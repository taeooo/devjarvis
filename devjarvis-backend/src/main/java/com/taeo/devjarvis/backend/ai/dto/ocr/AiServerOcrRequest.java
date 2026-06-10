package com.taeo.devjarvis.backend.ai.dto.ocr;

public record AiServerOcrRequest(
        String requestId,
        String commandId,
        String intent,
        String contextMode,
        String mimeType,
        String imageBase64,
        int width,
        int height,
        int byteSize,
        String capturedAt
) {
}
