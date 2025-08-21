/**
 * Input Validation Utility
 * Provides type-safe validation for all user inputs
 */

class ValidationError extends Error {
  constructor(field, value, expectedType) {
    super(`Invalid ${field}: expected ${expectedType}, got ${typeof value}`);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
    this.expectedType = expectedType;
  }
}

class Validator {
  /**
   * Validate required string
   */
  static validateString(value, fieldName, options = {}) {
    if (typeof value !== 'string') {
      throw new ValidationError(fieldName, value, 'string');
    }
    
    if (options.required && (!value || value.trim().length === 0)) {
      throw new ValidationError(fieldName, value, 'non-empty string');
    }
    
    if (options.minLength && value.length < options.minLength) {
      throw new ValidationError(fieldName, value, `string with minimum length ${options.minLength}`);
    }
    
    if (options.maxLength && value.length > options.maxLength) {
      throw new ValidationError(fieldName, value, `string with maximum length ${options.maxLength}`);
    }
    
    if (options.pattern && !options.pattern.test(value)) {
      throw new ValidationError(fieldName, value, `string matching pattern ${options.pattern}`);
    }
    
    return value.trim();
  }

  /**
   * Validate number
   */
  static validateNumber(value, fieldName, options = {}) {
    const num = Number(value);
    
    if (isNaN(num)) {
      throw new ValidationError(fieldName, value, 'number');
    }
    
    if (options.min !== undefined && num < options.min) {
      throw new ValidationError(fieldName, value, `number >= ${options.min}`);
    }
    
    if (options.max !== undefined && num > options.max) {
      throw new ValidationError(fieldName, value, `number <= ${options.max}`);
    }
    
    if (options.integer && !Number.isInteger(num)) {
      throw new ValidationError(fieldName, value, 'integer');
    }
    
    return num;
  }

  /**
   * Validate array
   */
  static validateArray(value, fieldName, options = {}) {
    if (!Array.isArray(value)) {
      throw new ValidationError(fieldName, value, 'array');
    }
    
    if (options.minLength && value.length < options.minLength) {
      throw new ValidationError(fieldName, value, `array with minimum length ${options.minLength}`);
    }
    
    if (options.maxLength && value.length > options.maxLength) {
      throw new ValidationError(fieldName, value, `array with maximum length ${options.maxLength}`);
    }
    
    if (options.itemValidator) {
      value.forEach((item, index) => {
        try {
          options.itemValidator(item, `${fieldName}[${index}]`);
        } catch (error) {
          throw new ValidationError(`${fieldName}[${index}]`, item, error.expectedType);
        }
      });
    }
    
    return value;
  }

  /**
   * Validate object
   */
  static validateObject(value, fieldName, schema = {}) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new ValidationError(fieldName, value, 'object');
    }
    
    const result = {};
    
    // Validate required fields
    for (const [key, validator] of Object.entries(schema)) {
      if (value.hasOwnProperty(key)) {
        result[key] = validator(value[key], `${fieldName}.${key}`);
      } else if (validator.required) {
        throw new ValidationError(`${fieldName}.${key}`, undefined, 'required field');
      }
    }
    
    return result;
  }

  /**
   * Validate API key format
   */
  static validateAPIKey(value, fieldName) {
    this.validateString(value, fieldName, { 
      required: true, 
      minLength: 10,
      pattern: /^[a-zA-Z0-9_-]+$/
    });
    return value;
  }

  /**
   * Validate URL
   */
  static validateURL(value, fieldName, options = {}) {
    this.validateString(value, fieldName, { required: options.required });
    
    try {
      const url = new URL(value);
      
      if (options.protocols && !options.protocols.includes(url.protocol.slice(0, -1))) {
        throw new ValidationError(fieldName, value, `URL with protocol: ${options.protocols.join(', ')}`);
      }
      
      return value;
    } catch (error) {
      throw new ValidationError(fieldName, value, 'valid URL');
    }
  }

  /**
   * Validate Discord webhook URL
   */
  static validateDiscordWebhook(value, fieldName) {
    this.validateURL(value, fieldName, { 
      required: true,
      protocols: ['https']
    });
    
    if (!value.includes('discord.com/api/webhooks/')) {
      throw new ValidationError(fieldName, value, 'Discord webhook URL');
    }
    
    return value;
  }

  /**
   * Validate environment variable
   */
  static validateEnvVar(varName, options = {}) {
    const value = process.env[varName];
    
    if (options.required && !value) {
      throw new Error(`Required environment variable ${varName} is not set`);
    }
    
    if (value && options.validator) {
      return options.validator(value, varName);
    }
    
    return value;
  }

  /**
   * Sanitize user input to prevent XSS
   */
  static sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    
    return input
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  }
}

module.exports = { Validator, ValidationError };