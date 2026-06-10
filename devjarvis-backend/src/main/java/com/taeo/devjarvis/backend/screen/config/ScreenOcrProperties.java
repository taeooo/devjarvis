package com.taeo.devjarvis.backend.screen.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@ConfigurationProperties(prefix = "devjarvis.screen.ocr")
public class ScreenOcrProperties {

    private boolean enabled = true;
    private int maxImageBytes = 1_500_000;
    private int maxWidth = 4096;
    private int maxHeight = 4096;
    private int previewCharacters = 700;
    private List<String> allowedMimeTypes = List.of(
            "image/jpeg",
            "image/png",
            "image/webp"
    );

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public int getMaxImageBytes() {
        return maxImageBytes;
    }

    public void setMaxImageBytes(int maxImageBytes) {
        this.maxImageBytes = maxImageBytes <= 0 ? 1_500_000 : maxImageBytes;
    }

    public int getMaxWidth() {
        return maxWidth;
    }

    public void setMaxWidth(int maxWidth) {
        this.maxWidth = maxWidth <= 0 ? 4096 : maxWidth;
    }

    public int getMaxHeight() {
        return maxHeight;
    }

    public void setMaxHeight(int maxHeight) {
        this.maxHeight = maxHeight <= 0 ? 4096 : maxHeight;
    }

    public int getPreviewCharacters() {
        return previewCharacters;
    }

    public void setPreviewCharacters(int previewCharacters) {
        this.previewCharacters = previewCharacters <= 0 ? 700 : previewCharacters;
    }

    public List<String> getAllowedMimeTypes() {
        return allowedMimeTypes;
    }

    public void setAllowedMimeTypes(List<String> allowedMimeTypes) {
        if (allowedMimeTypes == null || allowedMimeTypes.isEmpty()) {
            this.allowedMimeTypes = List.of("image/jpeg", "image/png", "image/webp");
            return;
        }
        this.allowedMimeTypes = allowedMimeTypes;
    }
}
