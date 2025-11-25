import { GoogleGenerativeAI } from "@google/generative-ai";
import { createServiceLogger } from "./logger.js";

const logger = createServiceLogger("gemini-client");

let geminiClient = null;
let geminiModel = null;

/**
 * Initialize Gemini client with API key
 * @returns {GoogleGenerativeAI} Gemini client instance
 */
export function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    logger.warn("GEMINI_API_KEY not found in environment variables");
    return null;
  }

  if (!geminiClient) {
    try {
      geminiClient = new GoogleGenerativeAI(apiKey);
      logger.info("Gemini client initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize Gemini client:", error);
      return null;
    }
  }

  return geminiClient;
}

/**
 * Get Gemini Flash model instance
 * @returns {GenerativeModel} Gemini Flash model
 */
export function getGeminiModel() {
  const client = getGeminiClient();
  if (!client) {
    return null;
  }

  if (!geminiModel) {
    // Use gemini-2.5-flash-live as default
    // Can override with GEMINI_MODEL env var
    const primaryModel = process.env.GEMINI_MODEL || "gemini-2.5-flash-live";

    // Fallback models in order of preference
    const fallbackModels = [
      "gemini-2.5-flash",        // Alternative flash model
      "gemini-2.0-flash-lite",    // Previous default
      "gemini-flash-latest",      // Latest flash model
    ];

    // Try primary model first, then fallbacks
    const modelsToTry = [primaryModel, ...fallbackModels];

    let lastError = null;
    for (const modelName of modelsToTry) {
      try {
        geminiModel = client.getGenerativeModel({ model: modelName });
        logger.info(`Gemini model loaded: ${modelName}`);
        break; // Success, exit loop
      } catch (error) {
        lastError = error;
        logger.warn(`Failed to load Gemini model "${modelName}":`, error.message);
        // Continue to next fallback
      }
    }

    if (!geminiModel) {
      logger.error("Failed to load any Gemini model. Last error:", lastError);
      return null;
    }
  }

  return geminiModel;
}

/**
 * Generate text response using Gemini Flash
 * @param {string} prompt - The prompt to send to Gemini
 * @param {Object} options - Additional options (temperature, maxTokens, etc.)
 * @returns {Promise<string>} Generated text response
 */
export async function generateText(prompt, options = {}) {
  const model = getGeminiModel();
  if (!model) {
    throw new Error("Gemini model not available. Check GEMINI_API_KEY configuration.");
  }

  try {
    const {
      temperature = 0.7,
      maxTokens = 2048,
      topP = 0.95,
      topK = 40,
    } = options;

    const generationConfig = {
      temperature,
      topP,
      topK,
      maxOutputTokens: maxTokens,
    };

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig,
    });

    const response = await result.response;

    // Check if response was blocked
    if (!response || !response.candidates || response.candidates.length === 0) {
      logger.error("Gemini response blocked or empty:", {
        finishReason: response?.candidates?.[0]?.finishReason,
        safetyRatings: response?.candidates?.[0]?.safetyRatings,
      });
      throw new Error("AI response was blocked. Please try rephrasing your question.");
    }

    const text = response.text();

    if (!text || text.trim().length === 0) {
      logger.error("Empty text in Gemini response");
      throw new Error("AI service returned an empty response. Please try again.");
    }

    return text;
  } catch (error) {
    logger.error("Gemini API error:", error);
    logger.error("Gemini API error details:", {
      message: error.message,
      name: error.name,
      code: error.code,
      status: error.status,
    });

    // Handle rate limiting
    if (error.message?.includes("429") || error.message?.includes("quota") || error.status === 429) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }

    // Handle API key errors
    if (error.message?.includes("API_KEY") || error.message?.includes("401") || error.status === 401) {
      throw new Error("Invalid API key. Please check GEMINI_API_KEY configuration.");
    }

    // Handle blocked content
    if (error.message?.includes("blocked") || error.message?.includes("safety")) {
      throw error;
    }

    throw error;
  }
}

/**
 * Generate text with retry logic and exponential backoff
 * @param {string} prompt - The prompt to send to Gemini
 * @param {Object} options - Additional options
 * @param {number} maxRetries - Maximum number of retries (default: 3)
 * @returns {Promise<string>} Generated text response
 */
export async function generateTextWithRetry(prompt, options = {}, maxRetries = 3) {
  let lastError = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await generateText(prompt, options);
    } catch (error) {
      lastError = error;

      // Don't retry on API key errors
      if (error.message?.includes("API_KEY") || error.message?.includes("401")) {
        throw error;
      }

      // Don't retry on rate limits if we've already tried
      if (error.message?.includes("Rate limit") && attempt > 0) {
        throw error;
      }

      // Exponential backoff: wait 2^attempt seconds
      if (attempt < maxRetries - 1) {
        const waitTime = Math.pow(2, attempt) * 1000;
        logger.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${waitTime}ms`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  throw lastError;
}

/**
 * Generate content from image using Gemini Vision
 * @param {string} imageBase64 - Base64 encoded image
 * @param {string} mimeType - MIME type of the image (e.g., "image/jpeg")
 * @param {string} prompt - Prompt describing what to extract from the image
 * @returns {Promise<string>} Generated text response
 */
export async function generateFromImage(imageBase64, mimeType, prompt) {
  const model = getGeminiModel();
  if (!model) {
    throw new Error("Gemini model not available. Check GEMINI_API_KEY configuration.");
  }

  try {
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: imageBase64,
                mimeType,
              },
            },
          ],
        },
      ],
    });

    const response = await result.response;
    const text = response.text();

    return text;
  } catch (error) {
    logger.error("Gemini Vision API error:", error);

    if (error.message?.includes("429") || error.message?.includes("quota")) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }

    if (error.message?.includes("API_KEY") || error.message?.includes("401")) {
      throw new Error("Invalid API key. Please check GEMINI_API_KEY configuration.");
    }

    throw error;
  }
}

/**
 * Extract receipt data from image using Gemini Vision
 * @param {string} imageBase64 - Base64 encoded image
 * @param {string} mimeType - MIME type of the image (e.g., "image/jpeg")
 * @returns {Promise<Object>} Extracted receipt data
 */
export async function extractReceiptData(imageBase64, mimeType) {
  const prompt = `Extract receipt information from this image and return ONLY a valid JSON object with the following structure:
{
  "merchant": "merchant name or null",
  "amount": total amount as number or null,
  "total": total amount as number or null,
  "date": date in ISO format (YYYY-MM-DD) or null,
  "category": "Food|Transport|Shopping|Bills|Entertainment|Healthcare|Education|Travel|Other" or null,
  "subtotal": subtotal as number or null,
  "tax": tax amount as number or null,
  "tip": tip amount as number or null,
  "items": [{"name": "item name", "price": price as number}],
  "payment_method": "payment method" or null
}

Return ONLY the JSON object, no other text.`;

  try {
    const responseText = await generateFromImage(imageBase64, mimeType, prompt);

    // Extract JSON from response (handle cases where response includes markdown code blocks)
    let jsonText = responseText.trim();
    if (jsonText.startsWith("```json")) {
      jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "");
    } else if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/```\n?/g, "");
    }

    const extractedData = JSON.parse(jsonText);

    // Calculate confidence based on extracted fields
    let confidence = 0;
    if (extractedData.merchant) {confidence += 0.2;}
    if (extractedData.amount || extractedData.total) {confidence += 0.3;}
    if (extractedData.date) {confidence += 0.2;}
    if (extractedData.category) {confidence += 0.1;}
    if (extractedData.items && extractedData.items.length > 0) {confidence += 0.2;}

    return {
      merchant: extractedData.merchant || null,
      amount: extractedData.amount || extractedData.total || null,
      date: extractedData.date || null,
      category: extractedData.category || null,
      subtotal: extractedData.subtotal || null,
      tax: extractedData.tax || null,
      tip: extractedData.tip || null,
      items: extractedData.items || [],
      payment_method: extractedData.payment_method || null,
      confidence: Math.min(confidence, 1.0),
    };
  } catch (error) {
    logger.error("Receipt OCR extraction error:", error);
    throw error;
  }
}

