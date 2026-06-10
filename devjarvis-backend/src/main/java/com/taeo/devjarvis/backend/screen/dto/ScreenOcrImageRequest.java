package com.taeo.devjarvis.backend.screen.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record ScreenOcrImageRequest(
        @NotBlank String dataUrl,
        @NotBlank String mimeType,
        @Min(1) @Max(4096) int width,
        @Min(1) @Max(4096) int height,
        @Min(1) @Max(5_000_000) int byteSize,
        @NotBlank String capturedAt
) {
}
