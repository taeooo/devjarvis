package com.taeo.devjarvis.backend.screen.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ScreenOcrRequest(
        @NotBlank @Size(max = 128) @Pattern(regexp = "^[A-Za-z0-9._:-]{8,128}$") String commandId,
        @NotBlank @Size(max = 64) String intent,
        @NotBlank @Size(max = 32) String contextMode,
        @Valid @NotNull ScreenOcrImageRequest image
) {
}
