package com.taeo.devjarvis.backend.screen.service;

import com.taeo.devjarvis.backend.screen.config.ScreenOcrProperties;
import com.taeo.devjarvis.backend.screen.dto.ScreenOcrImageRequest;
import org.junit.jupiter.api.Test;

import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ScreenImageValidatorTest {

    private static final String CAPTURED_AT = "2026-06-10T00:00:00Z";

    @Test
    void validateAcceptsSafeJpegDataUrl() {
        ScreenImageValidator validator = new ScreenImageValidator(new ScreenOcrProperties());
        byte[] jpegBytes = new byte[]{(byte) 0xff, (byte) 0xd8, (byte) 0xff, 0x00};
        String base64 = Base64.getEncoder().encodeToString(jpegBytes);

        ValidatedScreenImage result = validator.validate(new ScreenOcrImageRequest(
                "data:image/jpeg;base64," + base64,
                "image/jpeg",
                800,
                600,
                jpegBytes.length,
                CAPTURED_AT
        ));

        assertEquals("image/jpeg", result.mimeType());
        assertEquals(base64, result.base64());
        assertEquals(800, result.width());
        assertEquals(600, result.height());
        assertEquals(jpegBytes.length, result.byteSize());
    }

    @Test
    void validateRejectsDataUrlMimeTypeMismatch() {
        ScreenImageValidator validator = new ScreenImageValidator(new ScreenOcrProperties());
        byte[] jpegBytes = new byte[]{(byte) 0xff, (byte) 0xd8, (byte) 0xff, 0x00};
        String base64 = Base64.getEncoder().encodeToString(jpegBytes);

        ScreenOcrImageRequest request = new ScreenOcrImageRequest(
                "data:image/png;base64," + base64,
                "image/jpeg",
                800,
                600,
                jpegBytes.length,
                CAPTURED_AT
        );

        assertThrows(IllegalArgumentException.class, () -> validator.validate(request));
    }

    @Test
    void validateRejectsInvalidBinarySignature() {
        ScreenImageValidator validator = new ScreenImageValidator(new ScreenOcrProperties());
        byte[] invalidBytes = new byte[]{0x01, 0x02, 0x03, 0x04};
        String base64 = Base64.getEncoder().encodeToString(invalidBytes);

        ScreenOcrImageRequest request = new ScreenOcrImageRequest(
                "data:image/jpeg;base64," + base64,
                "image/jpeg",
                800,
                600,
                invalidBytes.length,
                CAPTURED_AT
        );

        assertThrows(IllegalArgumentException.class, () -> validator.validate(request));
    }

    @Test
    void validateRejectsPayloadLargerThanPolicy() {
        ScreenOcrProperties properties = new ScreenOcrProperties();
        properties.setMaxImageBytes(3);
        ScreenImageValidator validator = new ScreenImageValidator(properties);
        byte[] jpegBytes = new byte[]{(byte) 0xff, (byte) 0xd8, (byte) 0xff, 0x00};
        String base64 = Base64.getEncoder().encodeToString(jpegBytes);

        ScreenOcrImageRequest request = new ScreenOcrImageRequest(
                "data:image/jpeg;base64," + base64,
                "image/jpeg",
                800,
                600,
                jpegBytes.length,
                CAPTURED_AT
        );

        assertThrows(IllegalArgumentException.class, () -> validator.validate(request));
    }
}
