package com.taeo.devjarvis.backend.ai.dto;

public record AiServerHealthResponse(
        boolean reachable,
        int statusCode,
        String status,
        String service,
        String version,
        String rawBody,
        String errorMessage,
        long elapsedMillis
) {
    public static AiServerHealthResponse success(
            int statusCode,
            String status,
            String service,
            String version,
            String rawBody,
            long elapsedMillis
    ) {
        return new AiServerHealthResponse(
                true,
                statusCode,
                status,
                service,
                version,
                rawBody,
                null,
                elapsedMillis
        );
    }

    public static AiServerHealthResponse failure(
            String errorMessage,
            long elapsedMillis
    ) {
        return new AiServerHealthResponse(
                false,
                0,
                "DOWN",
                null,
                null,
                null,
                errorMessage,
                elapsedMillis
        );
    }
}
