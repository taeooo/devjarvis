package com.taeo.devjarvis.backend.ai.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "devjarvis.ai-server")
public record AiServerProperties(
        String baseUrl,
        int timeoutMillis
) {
    public AiServerProperties {
        if (baseUrl == null || baseUrl.isBlank()) {
            baseUrl = "http://127.0.0.1:8000";
        }
        if (timeoutMillis <= 0) {
            timeoutMillis = 3000;
        }
    }
}
