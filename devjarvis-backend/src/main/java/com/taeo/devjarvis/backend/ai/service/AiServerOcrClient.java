package com.taeo.devjarvis.backend.ai.service;

import com.taeo.devjarvis.backend.ai.config.AiServerProperties;
import com.taeo.devjarvis.backend.ai.dto.ocr.AiServerOcrImageResponse;
import com.taeo.devjarvis.backend.ai.dto.ocr.AiServerOcrRequest;
import com.taeo.devjarvis.backend.ai.dto.ocr.AiServerOcrResponse;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Component
public class AiServerOcrClient {

    private final AiServerProperties properties;
    private final HttpClient httpClient;

    public AiServerOcrClient(
            AiServerProperties properties,
            HttpClient aiServerHttpClient
    ) {
        this.properties = properties;
        this.httpClient = aiServerHttpClient;
    }

    public AiServerOcrResponse extract(AiServerOcrRequest payload) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(normalizeBaseUrl(properties.getBaseUrl()) + "/internal/ocr/extract"))
                    .timeout(Duration.ofMillis(properties.getTimeoutMillis()))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(toJson(payload)))
                    .build();

            HttpResponse<String> response = httpClient.send(
                    request,
                    HttpResponse.BodyHandlers.ofString()
            );

            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("AI server OCR request failed.");
            }

            return parseApiResponse(response.body());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("AI server OCR request was interrupted.");
        } catch (Exception exception) {
            throw new IllegalStateException("AI server OCR is unavailable.");
        }
    }

    private AiServerOcrResponse parseApiResponse(String body) {
        if (!extractBoolean(body, "success")) {
            String error = extractString(extractObject(body, "error"), "message");
            throw new IllegalStateException(error == null || error.isBlank()
                    ? "AI server OCR returned an unsuccessful response."
                    : error);
        }

        String data = extractObject(body, "data");
        if (data == null || data.isBlank()) {
            throw new IllegalStateException("AI server OCR returned an empty response.");
        }

        String image = extractObject(data, "image");
        AiServerOcrImageResponse imageResponse = image == null
                ? null
                : new AiServerOcrImageResponse(
                extractInt(image, "width"),
                extractInt(image, "height"),
                safeString(extractString(image, "mimeType")),
                extractInt(image, "byteSize")
        );

        String text = safeString(extractString(data, "text"));
        return new AiServerOcrResponse(
                safeString(extractString(data, "requestId")),
                safeString(extractString(data, "provider")),
                safeString(extractString(data, "status")),
                text,
                extractBoolean(data, "textFound"),
                safeString(extractString(data, "language")),
                extractDouble(data, "confidence"),
                List.of(),
                imageResponse,
                extractStringArray(data, "warnings"),
                extractLong(data, "elapsedMillis")
        );
    }

    private String toJson(AiServerOcrRequest payload) {
        StringBuilder builder = new StringBuilder();
        builder.append('{');
        appendStringField(builder, "requestId", payload.requestId());
        appendStringField(builder, "commandId", payload.commandId());
        appendStringField(builder, "intent", payload.intent());
        appendStringField(builder, "contextMode", payload.contextMode());
        appendStringField(builder, "mimeType", payload.mimeType());
        appendStringField(builder, "imageBase64", payload.imageBase64());
        appendNumberField(builder, "width", payload.width());
        appendNumberField(builder, "height", payload.height());
        appendNumberField(builder, "byteSize", payload.byteSize());
        appendStringField(builder, "capturedAt", payload.capturedAt());
        if (builder.charAt(builder.length() - 1) == ',') {
            builder.deleteCharAt(builder.length() - 1);
        }
        builder.append('}');
        return builder.toString();
    }

    private void appendStringField(StringBuilder builder, String key, String value) {
        builder.append('"').append(key).append("\":");
        if (value == null) {
            builder.append("null,");
            return;
        }
        builder.append('"').append(escapeJson(value)).append("\",");
    }

    private void appendNumberField(StringBuilder builder, String key, int value) {
        builder.append('"').append(key).append("\":").append(value).append(',');
    }

    private String escapeJson(String value) {
        StringBuilder escaped = new StringBuilder(value.length());
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            switch (character) {
                case '"' -> escaped.append("\\\"");
                case '\\' -> escaped.append("\\\\");
                case '\b' -> escaped.append("\\b");
                case '\f' -> escaped.append("\\f");
                case '\n' -> escaped.append("\\n");
                case '\r' -> escaped.append("\\r");
                case '\t' -> escaped.append("\\t");
                default -> {
                    if (character < 0x20) {
                        escaped.append(String.format(Locale.ROOT, "\\u%04x", (int) character));
                    } else {
                        escaped.append(character);
                    }
                }
            }
        }
        return escaped.toString();
    }

    private boolean extractBoolean(String json, String key) {
        String value = extractRawValue(json, key);
        return "true".equalsIgnoreCase(value);
    }

    private int extractInt(String json, String key) {
        return (int) extractLong(json, key);
    }

    private long extractLong(String json, String key) {
        String value = extractRawValue(json, key);
        if (value == null || value.isBlank()) {
            return 0L;
        }
        try {
            return Long.parseLong(value.replaceAll("[^0-9-]", ""));
        } catch (NumberFormatException exception) {
            return 0L;
        }
    }

    private Double extractDouble(String json, String key) {
        String value = extractRawValue(json, key);
        if (value == null || value.isBlank() || "null".equals(value)) {
            return null;
        }
        try {
            return Double.parseDouble(value.replaceAll("[^0-9.+-]", ""));
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private String extractString(String json, String key) {
        if (json == null || json.isBlank()) {
            return null;
        }
        String token = '"' + key + '"';
        int keyIndex = json.indexOf(token);
        if (keyIndex < 0) {
            return null;
        }
        int colonIndex = json.indexOf(':', keyIndex + token.length());
        if (colonIndex < 0) {
            return null;
        }
        int valueStart = skipWhitespace(json, colonIndex + 1);
        if (valueStart >= json.length() || json.charAt(valueStart) != '"') {
            return null;
        }
        return readJsonString(json, valueStart);
    }

    private List<String> extractStringArray(String json, String key) {
        String array = extractArray(json, key);
        if (array == null || array.length() < 2) {
            return List.of();
        }
        List<String> values = new ArrayList<>();
        int index = 1;
        while (index < array.length() - 1) {
            index = skipWhitespace(array, index);
            if (index >= array.length() - 1) {
                break;
            }
            if (array.charAt(index) == '"') {
                values.add(readJsonString(array, index));
                index = findStringEnd(array, index) + 1;
            } else {
                index++;
            }
        }
        return values;
    }

    private String extractObject(String json, String key) {
        return extractBalancedValue(json, key, '{', '}');
    }

    private String extractArray(String json, String key) {
        return extractBalancedValue(json, key, '[', ']');
    }

    private String extractBalancedValue(String json, String key, char open, char close) {
        if (json == null || json.isBlank()) {
            return null;
        }
        String token = '"' + key + '"';
        int keyIndex = json.indexOf(token);
        if (keyIndex < 0) {
            return null;
        }
        int colonIndex = json.indexOf(':', keyIndex + token.length());
        if (colonIndex < 0) {
            return null;
        }
        int start = skipWhitespace(json, colonIndex + 1);
        if (start >= json.length() || json.charAt(start) != open) {
            return null;
        }
        int depth = 0;
        boolean inString = false;
        boolean escaped = false;
        for (int index = start; index < json.length(); index++) {
            char character = json.charAt(index);
            if (inString) {
                if (escaped) {
                    escaped = false;
                } else if (character == '\\') {
                    escaped = true;
                } else if (character == '"') {
                    inString = false;
                }
                continue;
            }
            if (character == '"') {
                inString = true;
            } else if (character == open) {
                depth++;
            } else if (character == close) {
                depth--;
                if (depth == 0) {
                    return json.substring(start, index + 1);
                }
            }
        }
        return null;
    }

    private String extractRawValue(String json, String key) {
        if (json == null || json.isBlank()) {
            return null;
        }
        String token = '"' + key + '"';
        int keyIndex = json.indexOf(token);
        if (keyIndex < 0) {
            return null;
        }
        int colonIndex = json.indexOf(':', keyIndex + token.length());
        if (colonIndex < 0) {
            return null;
        }
        int start = skipWhitespace(json, colonIndex + 1);
        int end = start;
        while (end < json.length()) {
            char character = json.charAt(end);
            if (character == ',' || character == '}' || character == ']') {
                break;
            }
            end++;
        }
        return json.substring(start, end).trim();
    }

    private String readJsonString(String json, int quoteStart) {
        StringBuilder value = new StringBuilder();
        for (int index = quoteStart + 1; index < json.length(); index++) {
            char character = json.charAt(index);
            if (character == '"') {
                return value.toString();
            }
            if (character == '\\' && index + 1 < json.length()) {
                char escaped = json.charAt(++index);
                switch (escaped) {
                    case '"' -> value.append('"');
                    case '\\' -> value.append('\\');
                    case '/' -> value.append('/');
                    case 'b' -> value.append('\b');
                    case 'f' -> value.append('\f');
                    case 'n' -> value.append('\n');
                    case 'r' -> value.append('\r');
                    case 't' -> value.append('\t');
                    case 'u' -> {
                        if (index + 4 < json.length()) {
                            String hex = json.substring(index + 1, index + 5);
                            try {
                                value.append((char) Integer.parseInt(hex, 16));
                            } catch (NumberFormatException exception) {
                                value.append("\\u").append(hex);
                            }
                            index += 4;
                        }
                    }
                    default -> value.append(escaped);
                }
            } else {
                value.append(character);
            }
        }
        return value.toString();
    }

    private int findStringEnd(String json, int quoteStart) {
        boolean escaped = false;
        for (int index = quoteStart + 1; index < json.length(); index++) {
            char character = json.charAt(index);
            if (escaped) {
                escaped = false;
            } else if (character == '\\') {
                escaped = true;
            } else if (character == '"') {
                return index;
            }
        }
        return json.length() - 1;
    }

    private int skipWhitespace(String value, int start) {
        int index = start;
        while (index < value.length() && Character.isWhitespace(value.charAt(index))) {
            index++;
        }
        return index;
    }

    private String safeString(String value) {
        return value == null ? "" : value;
    }

    private String normalizeBaseUrl(String baseUrl) {
        if (baseUrl.endsWith("/")) {
            return baseUrl.substring(0, baseUrl.length() - 1);
        }
        return baseUrl;
    }
}
