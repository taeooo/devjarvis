package com.taeo.devjarvis.backend.screen.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ScreenAnalysisRequest(
        @NotBlank @Size(max = 128) @Pattern(regexp = "^[A-Za-z0-9._:-]{8,128}$") String commandId,
        @NotBlank @Size(max = 64) String intent,
        @NotBlank @Size(max = 32) String contextMode,
        @NotBlank @Size(max = 64) String ocrProvider,
        @NotNull @Size(max = 12000) String ocrText,
        boolean ocrTextFound,
        @Min(1) @Max(4096) int width,
        @Min(1) @Max(4096) int height,
        @NotBlank @Size(max = 128) String capturedAt
) {
}
