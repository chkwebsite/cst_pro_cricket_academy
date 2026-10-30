/**
 * File validation utility for CST Academy
 * - Maximum image size: 2 MB (2,097,152 bytes)
 * - Maximum video size: 20 MB (20,971,520 bytes)
 */

export const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2 MB
export const MAX_VIDEO_SIZE = 20 * 1024 * 1024; // 20 MB

/**
 * Validates an image file against the 2MB size limit.
 * Returns { valid: boolean, message?: string }
 */
export function validateImageFile(file) {
    if (!file) return { valid: true };

    if (file.size > MAX_IMAGE_SIZE) {
        const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
        return {
            valid: false,
            message: `Selected image is ${sizeMb} MB. Maximum allowed image size is 2 MB. Please upload a smaller image.`,
        };
    }

    return { valid: true };
}

/**
 * Validates a video file against the 20MB size limit.
 * Returns { valid: boolean, message?: string }
 */
export function validateVideoFile(file) {
    if (!file) return { valid: true };

    if (file.size > MAX_VIDEO_SIZE) {
        const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
        return {
            valid: false,
            message: `Selected video is ${sizeMb} MB. Maximum allowed video size is 20 MB. Please upload a smaller video.`,
        };
    }

    return { valid: true };
}

/**
 * Helper to check file input event directly.
 * If invalid, alerts user, clears input, and returns false.
 */
export function handleFileInputValidation(event, type = "image") {
    const file = event.target.files?.[0];
    if (!file) return true;

    const result = type === "video" ? validateVideoFile(file) : validateImageFile(file);

    if (!result.valid) {
        alert(result.message);
        event.target.value = "";
        return false;
    }

    return true;
}
