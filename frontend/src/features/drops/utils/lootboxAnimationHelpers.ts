// src/utils/lootboxAnimationHelpers.ts

interface PredeterminedResult {
    reward_name: string;
    quality: string;
    image_url?: string;
}

interface AnimationConfig {
    cycleSpeed: number;
    totalCycles: number;
}

const DEFAULT_ANIMATION_CONFIG: AnimationConfig = {
    cycleSpeed: 150, // ms per image
    totalCycles: 3, // Number of full cycles through images
};

/**
 * Calculate total animation frames
 */
export function calculateTotalFrames(imageCount: number, config: AnimationConfig = DEFAULT_ANIMATION_CONFIG): number {
    return imageCount * config.totalCycles;
}

/**
 * Get current image index for animation frame
 */
export function getAnimationImageIndex(currentFrame: number, imageCount: number): number {
    return currentFrame % imageCount;
}

/**
 * Check if animation should complete
 */
export function shouldCompleteAnimation(currentFrame: number, totalFrames: number): boolean {
    return currentFrame >= totalFrames;
}

/**
 * Get display image (result or animation frame)
 */
export function getDisplayImage(
    finalResult: PredeterminedResult | null,
    images: string[] | undefined,
    currentImageIndex: number
): string | null {
    if (finalResult?.image_url) {
        return finalResult.image_url;
    }

    if (images && images.length > 0) {
        return images[currentImageIndex];
    }

    return null;
}

/**
 * Get animation config
 */
export function getAnimationConfig(): AnimationConfig {
    return DEFAULT_ANIMATION_CONFIG;
}
