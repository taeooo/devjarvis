package com.taeo.devjarvis.backend.screen.service;

public record ValidatedScreenImage(
        String mimeType,
        String base64,
        byte[] bytes,
        int width,
        int height,
        int byteSize,
        String capturedAt
) {
}
