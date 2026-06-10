package com.taeo.devjarvis.backend.security.ratelimit;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.List;

@Component
@ConfigurationProperties(prefix = "devjarvis.rate-limit")
public class RateLimitProperties {

    private boolean enabled = true;
    private int writeRequestsPerMinute = 60;
    private int manifestRequestsPerMinute = 10;
    private int maxTrackedClients = 10_000;
    private List<String> excludedPaths = List.of(
            "/actuator/health",
            "/api/system/health",
            "/api/system/ai-server/health"
    );

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public int getWriteRequestsPerMinute() {
        return writeRequestsPerMinute;
    }

    public void setWriteRequestsPerMinute(int writeRequestsPerMinute) {
        this.writeRequestsPerMinute = writeRequestsPerMinute;
    }

    public int getManifestRequestsPerMinute() {
        return manifestRequestsPerMinute;
    }

    public void setManifestRequestsPerMinute(int manifestRequestsPerMinute) {
        this.manifestRequestsPerMinute = manifestRequestsPerMinute;
    }

    public int getMaxTrackedClients() {
        return maxTrackedClients;
    }

    public void setMaxTrackedClients(int maxTrackedClients) {
        this.maxTrackedClients = maxTrackedClients;
    }

    public List<String> getExcludedPaths() {
        return excludedPaths;
    }

    public void setExcludedPaths(List<String> excludedPaths) {
        this.excludedPaths = excludedPaths;
    }

    public Duration window() {
        return Duration.ofMinutes(1);
    }
}
