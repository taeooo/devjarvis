package com.taeo.devjarvis.backend.ai.dto.ocr;

public record AiServerOcrImageResponse(
        int width,
        int height,
        String mimeType,
        int byteSize
) {
}
