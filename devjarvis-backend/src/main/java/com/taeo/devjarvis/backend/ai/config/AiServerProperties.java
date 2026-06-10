package com.taeo.devjarvis.backend.ai.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "devjarvis.ai-server")
public class AiServerProperties {

    private String baseUrl = "http://127.0.0.1:8000";
    private int timeoutMillis = 3000;

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        if (baseUrl == null || baseUrl.isBlank()) {
            this.baseUrl = "http://127.0.0.1:8000";
            return;
        }
        this.baseUrl = baseUrl;
    }

    public int getTimeoutMillis() {
        return timeoutMillis;
    }

    public void setTimeoutMillis(int timeoutMillis) {
        this.timeoutMillis = timeoutMillis <= 0 ? 3000 : timeoutMillis;
    }
}
