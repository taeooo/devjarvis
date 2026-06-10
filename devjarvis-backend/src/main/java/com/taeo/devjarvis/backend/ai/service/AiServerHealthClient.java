package com.taeo.devjarvis.backend.ai.service;

import com.taeo.devjarvis.backend.ai.config.AiServerProperties;
import com.taeo.devjarvis.backend.ai.dto.AiServerHealthResponse;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

@Component
public class AiServerHealthClient {

    private final AiServerProperties properties;
    private final HttpClient httpClient;

    public AiServerHealthClient(
            AiServerProperties properties,
            HttpClient aiServerHttpClient
    ) {
        this.properties = properties;
        this.httpClient = aiServerHttpClient;
    }

    public AiServerHealthResponse checkHealth() {
        long startedAt = System.currentTimeMillis();
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(normalizeBaseUrl(properties.getBaseUrl()) + "/internal/health"))
                    .timeout(Duration.ofMillis(properties.getTimeoutMillis()))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(
                    request,
                    HttpResponse.BodyHandlers.ofString()
            );
            long elapsedMillis = System.currentTimeMillis() - startedAt;
            String responseBody = response.body();

            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                return new AiServerHealthResponse(
                        false,
                        response.statusCode(),
                        "DOWN",
                        null,
                        null,
                        responseBody,
                        "AI server returned non-2xx status.",
                        elapsedMillis
                );
            }

            return AiServerHealthResponse.success(
                    response.statusCode(),
                    inferStatus(responseBody),
                    inferService(responseBody),
                    null,
                    responseBody,
                    elapsedMillis
            );
        } catch (Exception exception) {
            long elapsedMillis = System.currentTimeMillis() - startedAt;
            return AiServerHealthResponse.failure(exception.getMessage(), elapsedMillis);
        }
    }

    private String normalizeBaseUrl(String baseUrl) {
        if (baseUrl.endsWith("/")) {
            return baseUrl.substring(0, baseUrl.length() - 1);
        }
        return baseUrl;
    }

    private String inferStatus(String responseBody) {
        if (responseBody == null || responseBody.isBlank()) {
            return "UP";
        }
        if (responseBody.contains("\"status\":\"UP\"") || responseBody.contains("\"status\": \"UP\"")) {
            return "UP";
        }
        return "UNKNOWN";
    }

    private String inferService(String responseBody) {
        if (responseBody == null || responseBody.isBlank()) {
            return null;
        }
        if (responseBody.contains("devjarvis-ai-server")) {
            return "devjarvis-ai-server";
        }
        return null;
    }
}
