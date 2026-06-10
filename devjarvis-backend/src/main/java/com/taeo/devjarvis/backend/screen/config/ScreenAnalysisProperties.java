package com.taeo.devjarvis.backend.screen.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.Set;

@Component
@ConfigurationProperties(prefix = "devjarvis.screen.analysis")
public class ScreenAnalysisProperties {

    private boolean enabled = true;
    private int maxOcrTextCharacters = 12_000;
    private int previewCharacters = 900;
    private Set<String> allowedIntents = Set.of(
            "screen_translate",
            "screen_summary",
            "screen_error_analysis"
    );

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public int getMaxOcrTextCharacters() {
        return maxOcrTextCharacters;
    }

    public void setMaxOcrTextCharacters(int maxOcrTextCharacters) {
        this.maxOcrTextCharacters = maxOcrTextCharacters;
    }

    public int getPreviewCharacters() {
        return previewCharacters;
    }

    public void setPreviewCharacters(int previewCharacters) {
        this.previewCharacters = previewCharacters;
    }

    public Set<String> getAllowedIntents() {
        return allowedIntents;
    }

    public void setAllowedIntents(Set<String> allowedIntents) {
        this.allowedIntents = allowedIntents;
    }
}
