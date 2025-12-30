/**
 * Input Sanitization Utilities
 * 
 * Provides XSS prevention and input sanitization functions
 * for user-generated content before sending to API.
 * 
 * Defense in depth: Sanitize on frontend AND backend
 */

/**
 * Sanitize HTML to prevent XSS attacks
 * Escapes dangerous characters that could be used for script injection
 * 
 * @param input - Raw user input
 * @returns Sanitized string safe for display
 */
export function sanitizeHtml(input: string): string {
  if (!input) return '';
  
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitize input for general use
 * Removes dangerous characters while preserving readability
 * 
 * @param input - Raw user input
 * @param maxLength - Maximum allowed length (default: 1000)
 * @returns Sanitized string
 */
export function sanitizeInput(input: string, maxLength: number = 1000): string {
  if (!input) return '';
  
  let sanitized = input;
  
  // Remove control characters and invisible characters
  sanitized = sanitized.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
  
  // Remove potentially dangerous characters
  sanitized = sanitized.replace(/[<>"`]/g, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  return sanitized;
}

/**
 * Sanitize stream title
 * Allows most characters but removes HTML tags and scripts
 * 
 * @param title - Stream title
 * @returns Sanitized title
 */
export function sanitizeStreamTitle(title: string): string {
  if (!title) return '';
  
  let sanitized = title;
  
  // Remove HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '');
  
  // Remove script-like content
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');
  
  // Trim and limit length
  sanitized = sanitized.trim();
  if (sanitized.length > 140) {
    sanitized = sanitized.substring(0, 140);
  }
  
  return sanitized;
}

/**
 * Sanitize username
 * Only allows alphanumeric characters, underscores, and hyphens
 * 
 * @param username - Username input
 * @returns Sanitized username
 */
export function sanitizeUsername(username: string): string {
  if (!username) return '';
  
  // Remove all characters except alphanumeric, underscore, and hyphen
  let sanitized = username.replace(/[^a-zA-Z0-9_-]/g, '');
  
  // Trim and limit length
  sanitized = sanitized.trim();
  if (sanitized.length > 50) {
    sanitized = sanitized.substring(0, 50);
  }
  
  return sanitized;
}

/**
 * Sanitize URL
 * Ensures URL is safe and properly formatted
 * 
 * @param url - URL input
 * @returns Sanitized URL or empty string if invalid
 */
export function sanitizeUrl(url: string): string {
  if (!url) return '';
  
  let sanitized = url.trim();
  
  // Only allow http and https protocols
  if (!sanitized.match(/^https?:\/\//i)) {
    return '';
  }
  
  // Remove javascript: and data: protocols
  if (sanitized.match(/^(javascript|data):/i)) {
    return '';
  }
  
  // Limit length
  if (sanitized.length > 2048) {
    sanitized = sanitized.substring(0, 2048);
  }
  
  return sanitized;
}

/**
 * Sanitize command name
 * Only allows alphanumeric characters and underscores
 * 
 * @param commandName - Command name input
 * @returns Sanitized command name
 */
export function sanitizeCommandName(commandName: string): string {
  if (!commandName) return '';
  
  // Remove all characters except alphanumeric and underscore
  let sanitized = commandName.replace(/[^a-zA-Z0-9_]/g, '');
  
  // Convert to lowercase
  sanitized = sanitized.toLowerCase();
  
  // Trim and limit length
  sanitized = sanitized.trim();
  if (sanitized.length > 25) {
    sanitized = sanitized.substring(0, 25);
  }
  
  return sanitized;
}

/**
 * Sanitize voice name
 * Allows alphanumeric, spaces, hyphens, and underscores
 * 
 * @param voiceName - Voice name input
 * @returns Sanitized voice name
 */
export function sanitizeVoiceName(voiceName: string): string {
  if (!voiceName) return '';
  
  // Remove all characters except alphanumeric, spaces, hyphens, and underscores
  // Support both Latin and Cyrillic characters
  let sanitized = voiceName.replace(/[^a-zA-Zа-яА-ЯёЁ0-9\s_-]/g, '');
  
  // Trim and limit length
  sanitized = sanitized.trim();
  if (sanitized.length > 50) {
    sanitized = sanitized.substring(0, 50);
  }
  
  return sanitized;
}

/**
 * Sanitize TTS message
 * Removes dangerous characters while preserving message content
 * 
 * @param message - TTS message input
 * @returns Sanitized message
 */
export function sanitizeTtsMessage(message: string): string {
  if (!message) return '';
  
  let sanitized = message;
  
  // Remove HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '');
  
  // Remove control characters
  sanitized = sanitized.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
  
  // Trim and limit length
  sanitized = sanitized.trim();
  if (sanitized.length > 500) {
    sanitized = sanitized.substring(0, 500);
  }
  
  return sanitized;
}

/**
 * Sanitize JSON key
 * Only allows alphanumeric characters, underscores, and hyphens
 * 
 * @param key - JSON key input
 * @returns Sanitized key
 */
export function sanitizeJsonKey(key: string): string {
  if (!key) return '';
  
  // Remove all characters except alphanumeric, underscore, and hyphen
  let sanitized = key.replace(/[^a-zA-Z0-9_-]/g, '');
  
  // Trim and limit length
  sanitized = sanitized.trim();
  if (sanitized.length > 100) {
    sanitized = sanitized.substring(0, 100);
  }
  
  return sanitized;
}

/**
 * Sanitize number input
 * Ensures input is a valid number within bounds
 * 
 * @param value - Number input (string or number)
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @param defaultValue - Default value if invalid
 * @returns Sanitized number
 */
export function sanitizeNumber(
  value: string | number,
  min: number = -Infinity,
  max: number = Infinity,
  defaultValue: number = 0
): number {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(num)) {
    return defaultValue;
  }
  
  if (num < min) {
    return min;
  }
  
  if (num > max) {
    return max;
  }
  
  return num;
}

/**
 * Sanitize object by applying sanitization to all string values
 * 
 * @param obj - Object to sanitize
 * @param sanitizer - Sanitization function to apply (default: sanitizeInput)
 * @returns Sanitized object
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  sanitizer: (value: string) => string = sanitizeInput
): T {
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizer(value);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>, sanitizer);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized as T;
}

/**
 * Strip all HTML tags from input
 * More aggressive than sanitizeHtml - completely removes tags
 * 
 * @param input - HTML string
 * @returns Plain text without HTML
 */
export function stripHtmlTags(input: string): string {
  if (!input) return '';
  
  // Remove all HTML tags
  let stripped = input.replace(/<[^>]*>/g, '');
  
  // Decode HTML entities
  stripped = stripped
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&amp;/g, '&');
  
  return stripped.trim();
}

/**
 * Validate and sanitize email
 * 
 * @param email - Email input
 * @returns Sanitized email or empty string if invalid
 */
export function sanitizeEmail(email: string): string {
  if (!email) return '';
  
  const sanitized = email.trim().toLowerCase();
  
  // Basic email validation
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(sanitized)) {
    return '';
  }
  
  // Limit length
  if (sanitized.length > 254) {
    return '';
  }
  
  return sanitized;
}

/**
 * Sanitize file name
 * Removes path traversal attempts and dangerous characters
 * 
 * @param fileName - File name input
 * @returns Sanitized file name
 */
export function sanitizeFileName(fileName: string): string {
  if (!fileName) return '';
  
  let sanitized = fileName;
  
  // Remove path traversal attempts
  sanitized = sanitized.replace(/\.\./g, '');
  sanitized = sanitized.replace(/[\/\\]/g, '');
  
  // Remove dangerous characters
  sanitized = sanitized.replace(/[<>:"|?*\x00-\x1f]/g, '');
  
  // Trim and limit length
  sanitized = sanitized.trim();
  if (sanitized.length > 255) {
    sanitized = sanitized.substring(0, 255);
  }
  
  return sanitized;
}
