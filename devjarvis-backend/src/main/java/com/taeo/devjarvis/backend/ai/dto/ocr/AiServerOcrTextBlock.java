package com.taeo.devjarvis.backend.ai.dto.ocr;

public record AiServerOcrTextBlock(
        String text,
        double confidence,
        int x,
        int y,
        int width,
        int height
) {
}
