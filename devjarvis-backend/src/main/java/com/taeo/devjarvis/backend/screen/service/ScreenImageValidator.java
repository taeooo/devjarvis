package com.taeo.devjarvis.backend.screen.service;

import com.taeo.devjarvis.backend.screen.config.ScreenOcrProperties;
import com.taeo.devjarvis.backend.screen.dto.ScreenOcrImageRequest;
import org.springframework.stereotype.Component;

import java.util.Base64;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class ScreenImageValidator {

    private static final Pattern DATA_URL_PATTERN = Pattern.compile("^data:([^;,]+);base64,([A-Za-z0-9+/=\\r\\n]+)$");
    private static final Set<String> SAFE_MIME_TYPES = Set.of("image/jpeg", "image/png", "image/webp");

    private final ScreenOcrProperties properties;

    public ScreenImageValidator(ScreenOcrProperties properties) {
        this.properties = properties;
    }

    public ValidatedScreenImage validate(ScreenOcrImageRequest image) {
        if (!properties.isEnabled()) {
            throw new IllegalArgumentException("Screen OCR is disabled.");
        }

        String declaredMimeType = normalizeMimeType(image.mimeType());
        if (!SAFE_MIME_TYPES.contains(declaredMimeType) || !properties.getAllowedMimeTypes().contains(declaredMimeType)) {
            throw new IllegalArgumentException("Unsupported screen image type.");
        }

        if (image.width() <= 0 || image.width() > properties.getMaxWidth()) {
            throw new IllegalArgumentException("Screen image width is not allowed.");
        }
        if (image.height() <= 0 || image.height() > properties.getMaxHeight()) {
            throw new IllegalArgumentException("Screen image height is not allowed.");
        }

        Matcher matcher = DATA_URL_PATTERN.matcher(image.dataUrl().trim());
        if (!matcher.matches()) {
            throw new IllegalArgumentException("Screen image must be a base64 data URL.");
        }

        String dataUrlMimeType = normalizeMimeType(matcher.group(1));
        if (!declaredMimeType.equals(dataUrlMimeType)) {
            throw new IllegalArgumentException("Screen image MIME type mismatch.");
        }

        String normalizedBase64 = matcher.group(2).replaceAll("\\s", "");
        byte[] decoded;
        try {
            decoded = Base64.getDecoder().decode(normalizedBase64);
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("Screen image base64 payload is invalid.");
        }

        if (decoded.length <= 0) {
            throw new IllegalArgumentException("Screen image payload is empty.");
        }
        if (decoded.length > properties.getMaxImageBytes()) {
            throw new IllegalArgumentException("Screen image payload is too large.");
        }
        if (image.byteSize() != decoded.length) {
            throw new IllegalArgumentException("Screen image byte size mismatch.");
        }
        if (!hasExpectedMagicBytes(declaredMimeType, decoded)) {
            throw new IllegalArgumentException("Screen image binary signature is invalid.");
        }

        return new ValidatedScreenImage(
                declaredMimeType,
                normalizedBase64,
                decoded,
                image.width(),
                image.height(),
                decoded.length,
                image.capturedAt()
        );
    }

    private String normalizeMimeType(String value) {
        if (value == null) {
            return "";
        }
        return value.toLowerCase(Locale.ROOT).trim();
    }

    private boolean hasExpectedMagicBytes(String mimeType, byte[] bytes) {
        return switch (mimeType) {
            case "image/jpeg" -> bytes.length >= 3
                    && (bytes[0] & 0xff) == 0xff
                    && (bytes[1] & 0xff) == 0xd8
                    && (bytes[2] & 0xff) == 0xff;
            case "image/png" -> bytes.length >= 8
                    && (bytes[0] & 0xff) == 0x89
                    && bytes[1] == 0x50
                    && bytes[2] == 0x4e
                    && bytes[3] == 0x47
                    && bytes[4] == 0x0d
                    && bytes[5] == 0x0a
                    && bytes[6] == 0x1a
                    && bytes[7] == 0x0a;
            case "image/webp" -> bytes.length >= 12
                    && bytes[0] == 0x52
                    && bytes[1] == 0x49
                    && bytes[2] == 0x46
                    && bytes[3] == 0x46
                    && bytes[8] == 0x57
                    && bytes[9] == 0x45
                    && bytes[10] == 0x42
                    && bytes[11] == 0x50;
            default -> false;
        };
    }
}
