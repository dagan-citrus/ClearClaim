/**
 * Gemini LLM service for OCR and data extraction
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '@config/index';
import {
  ExtractedReceiptData,
  PaymentMethod,
  LLMProcessingError,
} from '@core/types';
import { z } from 'zod';

/**
 * Schema for receipt data extraction with lenient defaults
 */
const receiptDataSchema = z
  .object({
    retailerName: z.string().min(1).optional(),
    serviceDescription: z.string().min(1).optional(),
    receiptDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    totalAmount: z.number().positive().optional(),
    currency: z.string().default('USD'),
    invoiceNumber: z.string().optional(),
    receiptNumber: z.string().optional(),
    policyNumber: z.string().optional(),
    paymentMethod: z.nativeEnum(PaymentMethod).optional(),
    lineItems: z
      .array(
        z.object({
          description: z.string(),
          amount: z.number(),
          quantity: z.number().optional(),
        })
      )
      .optional(),
    extractionConfidence: z.number().min(0).max(100).optional(),
    // Medical-specific fields
    doctorName: z.string().optional(),
    doctorTitle: z.string().optional(),
    clinicAddress: z.string().optional(),
    visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    medicalIssues: z.array(z.string()).optional(),
    prescriptions: z.array(z.string()).optional(),
    recommendations: z.union([z.string(), z.array(z.string())]).optional(),
    claimType: z.string().optional(),
    attachmentDescriptions: z.array(z.string()).optional(),
  })
  .transform((data) => {
    // Provide sensible defaults for required fields
    return {
      retailerName: data.retailerName || 'Unknown Provider',
      serviceDescription: data.serviceDescription || 'Medical/Healthcare Service',
      receiptDate: data.receiptDate || new Date().toISOString().split('T')[0],
      totalAmount: data.totalAmount || 0,
      currency: data.currency || 'USD',
      invoiceNumber: data.invoiceNumber || undefined,
      receiptNumber: data.receiptNumber || undefined,
      policyNumber: data.policyNumber || undefined,
      paymentMethod: data.paymentMethod || PaymentMethod.OTHER,
      lineItems: data.lineItems && data.lineItems.length > 0
        ? data.lineItems
        : [{ description: 'Medical/Healthcare Service', amount: data.totalAmount || 0 }],
      extractionConfidence: data.extractionConfidence || 50,
      doctorName: data.doctorName,
      doctorTitle: data.doctorTitle,
      clinicAddress: data.clinicAddress,
      visitDate: data.visitDate,
      medicalIssues: data.medicalIssues,
      prescriptions: data.prescriptions,
      recommendations:
        typeof data.recommendations === 'string'
          ? data.recommendations
          : Array.isArray(data.recommendations)
            ? data.recommendations.join(', ')
            : undefined,
      claimType: data.claimType || 'Medical Consultation',
      attachmentDescriptions: data.attachmentDescriptions,
    };
  });

/**
 * Parse and categorize API errors
 */
function categorizeError(error: any): { userMessage: string; rawError: string } {
  const rawError = error instanceof Error ? error.message : String(error);
  let userMessage = '';

  // Check for specific error patterns
  if (rawError.includes('API_KEY') || rawError.includes('API key') || rawError.includes('authentication')) {
    userMessage = '🔑 Authentication Error: Invalid or missing API key. Please check your Gemini API configuration.';
  } else if (rawError.includes('quota') || rawError.includes('rate limit') || rawError.includes('429')) {
    userMessage = '⏱️ Quota Exceeded: API rate limit or quota reached. Please try again in a few minutes.';
  } else if (rawError.includes('network') || rawError.includes('ECONNREFUSED') || rawError.includes('timeout')) {
    userMessage = '🌐 Connection Error: Unable to connect to the AI service. Please check your internet connection and try again.';
  } else if (rawError.includes('400') || rawError.includes('invalid image') || rawError.includes('cannot load')) {
    userMessage = '📷 Image Error: The uploaded image is invalid or cannot be processed. Please try a different image.';
  } else if (rawError.includes('500') || rawError.includes('503') || rawError.includes('server error')) {
    userMessage = '⚠️ Server Error: The AI service is temporarily unavailable. Please try again in a few moments.';
  } else {
    userMessage = '❌ Processing Error: An unexpected error occurred while processing your request.';
  }

  return { userMessage, rawError };
}

/**
 * Retry utility with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      console.warn(`API call attempt ${attempt + 1} failed:`, error);

      // Don't retry if it's a validation error or client error
      if (error instanceof z.ZodError || error instanceof LLMProcessingError) {
        throw error;
      }

      // Check for non-retryable errors (auth, quota, invalid image)
      const errorStr = String(error);
      if (
        errorStr.includes('API_KEY') ||
        errorStr.includes('authentication') ||
        errorStr.includes('quota') ||
        errorStr.includes('400') ||
        errorStr.includes('invalid image')
      ) {
        // Don't retry these errors
        const { userMessage, rawError } = categorizeError(error);
        throw new LLMProcessingError(`${userMessage}\n\nRaw error: ${rawError}`);
      }

      // If this was the last attempt, throw with categorized error
      if (attempt === maxRetries - 1) {
        break;
      }

      // Wait with exponential backoff
      const delay = initialDelay * Math.pow(2, attempt);
      console.log(`Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // All retries failed
  const { userMessage, rawError } = categorizeError(lastError);
  throw new LLMProcessingError(
    `${userMessage}\n\nAfter ${maxRetries} retry attempts.\n\nRaw error: ${rawError}`
  );
}

/**
 * Gemini LLM service for receipt processing
 */
export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>;

  constructor() {
    this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    this.model = this.genAI.getGenerativeModel({ model: config.gemini.model });
  }

  /**
   * Extract receipt data from multiple images using Gemini Vision
   */
  async extractReceiptData(
    images: Array<{ data: string; type: string; description?: string }>
  ): Promise<ExtractedReceiptData> {
    try {
      const prompt = this.buildExtractionPrompt(images.length);

      // Prepare image parts for Gemini
      const imageParts = images.map((img) => {
        // Remove data URL prefix if present
        const base64Data = img.data.replace(/^data:image\/\w+;base64,/, '');
        return {
          inlineData: {
            data: base64Data,
            mimeType: img.type,
          },
        };
      });

      // Create content array with prompt and all images
      const content = [prompt, ...imageParts];

      // Wrap API call with retry logic
      const text = await retryWithBackoff(async () => {
        const result = await this.model.generateContent(content);
        const response = await result.response;
        return response.text();
      });

      // Parse JSON response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new LLMProcessingError('Failed to extract JSON from LLM response');
      }

      const parsedData = JSON.parse(jsonMatch[0]);
      const validatedData = receiptDataSchema.parse(parsedData);

      // Check for low confidence
      if (validatedData.extractionConfidence < 30) {
        throw new LLMProcessingError(
          `⚠️ Low Confidence: The image text could not be read clearly (${validatedData.extractionConfidence}% confidence).\n\nPlease try:\n- Taking a clearer photo\n- Ensuring good lighting\n- Avoiding glare or shadows\n- Using a higher resolution image\n\nRaw error: Extraction confidence too low (${validatedData.extractionConfidence}%)`
        );
      }

      // Check for missing critical data
      if (validatedData.totalAmount === 0 && (!validatedData.lineItems || validatedData.lineItems.length === 0)) {
        throw new LLMProcessingError(
          `📄 No Data Found: Could not extract any financial information from the image.\n\nPlease ensure:\n- The image contains a receipt or invoice\n- The text is clearly visible\n- The document includes amounts and descriptions\n\nRaw error: No amount or line items extracted`
        );
      }

      // Check if image appears to have no text
      if (
        validatedData.retailerName === 'Unknown Provider' &&
        validatedData.serviceDescription === 'Medical/Healthcare Service' &&
        validatedData.totalAmount === 0
      ) {
        throw new LLMProcessingError(
          `🖼️ No Text Detected: The image appears to contain no readable text.\n\nPlease check:\n- The image is not blank or corrupted\n- The image contains a receipt or document\n- The text in the image is legible\n\nRaw error: No meaningful data could be extracted (all default values)`
        );
      }

      return {
        ...validatedData,
        lineItems: validatedData.lineItems.map((item) => ({
          ...item,
          personId: undefined,
        })),
      };
    } catch (error) {
      if (error instanceof LLMProcessingError) {
        // Already formatted, re-throw as-is
        throw error;
      }
      if (error instanceof z.ZodError) {
        console.error('Gemini OCR Response Validation Error:', error.errors);
        throw new LLMProcessingError(
          `📋 Validation Error: The extracted data format is invalid.\n\n${error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('\n')}\n\nRaw error: Zod validation failed`
        );
      }
      throw new LLMProcessingError(
        `❌ Processing Error: Failed to extract receipt data.\n\nRaw error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate claim email draft with subject and body
   */
  async generateClaimEmail(
    receiptData: ExtractedReceiptData,
    insuredPersonName: string,
    policyNumber: string,
    insurerName: string,
    dateOfBirth?: string,
    templatePrompt?: string
  ): Promise<{ subject: string; body: string }> {
    try {
      const prompt = this.buildClaimEmailPrompt(
        receiptData,
        insuredPersonName,
        policyNumber,
        insurerName,
        dateOfBirth,
        templatePrompt
      );

      // Wrap API call with retry logic
      const text = await retryWithBackoff(async () => {
        const result = await this.model.generateContent(prompt);
        const response = await result.response;
        return response.text().trim();
      });

      // Extract subject and body
      const subjectMatch = text.match(/(?:Email )?Subject:\s*(.+?)(?:\n|$)/i);
      const subject = subjectMatch
        ? subjectMatch[1].trim()
        : `Health Insurance Claim – ${receiptData.claimType || 'Medical Consultation'} – ${insuredPersonName} – ${policyNumber}`;

      // Remove subject line from body if present
      const body = text
        .replace(/(?:Email )?Subject:\s*.+?(?:\n|$)/i, '')
        .trim();

      return { subject, body };
    } catch (error) {
      if (error instanceof LLMProcessingError) {
        throw error;
      }
      throw new LLMProcessingError(
        `✉️ Email Generation Error: Failed to generate claim email.\n\nRaw error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Refine existing email draft with natural language instructions
   */
  async refineDraft(
    currentSubject: string,
    currentBody: string,
    refinementPrompt: string
  ): Promise<{ subject: string; body: string }> {
    try {
      const prompt = `You are refining an insurance claim email based on user feedback.

Current Subject: ${currentSubject}

Current Email Body:
${currentBody}

User's Refinement Request: ${refinementPrompt}

Please revise the email body according to the user's request while maintaining professionalism and all necessary claim details. You may also update the subject line if the refinement request implies it should change.

Return the refined email in this exact format:
Subject: [subject line here]

[email body here]`;

      // Wrap API call with retry logic
      const text = await retryWithBackoff(async () => {
        const result = await this.model.generateContent(prompt);
        const response = await result.response;
        return response.text().trim();
      });

      // Extract subject and body
      const subjectMatch = text.match(/Subject:\s*(.+?)(?:\n|$)/i);
      const subject = subjectMatch ? subjectMatch[1].trim() : currentSubject;

      const body = text
        .replace(/Subject:\s*.+?(?:\n|$)/i, '')
        .trim();

      return { subject, body };
    } catch (error) {
      if (error instanceof LLMProcessingError) {
        throw error;
      }
      throw new LLMProcessingError(
        `✨ Refinement Error: Failed to refine email draft.\n\nRaw error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Build extraction prompt for multiple documents
   */
  private buildExtractionPrompt(imageCount: number): string {
    return `You are a medical receipt and documentation OCR expert. You have been provided with ${imageCount} image(s) that may contain:
- Medical invoices/receipts
- Doctor's summaries
- Medicine lists
- Prescription forms
- Other medical documentation

IMPORTANT: Analyze ALL provided images and extract ALL information from them. Combine information from multiple documents to form a complete picture of the medical claim.

Extract the following information:

BASIC CLAIM INFORMATION:
1. retailerName: The name of the clinic/hospital/medical facility
2. serviceDescription: Brief description of the medical service (e.g., "Medical consultation and treatment")
3. receiptDate: Date of the receipt/transaction in YYYY-MM-DD format
4. totalAmount: Total amount paid (as a number, no currency symbols). If multiple receipts, sum them up.
5. currency: Currency code (default to "USD" if not specified)
6. invoiceNumber: Invoice number if present (optional)
7. receiptNumber: Receipt number if present (optional)
8. policyNumber: Insurance policy/member/card ID if visible (optional)
9. paymentMethod: One of: CASH, CREDIT_CARD, DEBIT_CARD, CHECK, BANK_TRANSFER, OTHER
10. lineItems: Array of ALL line items from ALL documents, each with:
   - description: Item/service/medication description
   - amount: Item amount (as a number)
   - quantity: Quantity if specified (optional)
11. extractionConfidence: Your confidence level in the extraction (0-100)

MEDICAL-SPECIFIC INFORMATION:
12. doctorName: Full name of the doctor (optional)
13. doctorTitle: Doctor's title/specialty (e.g., "Dr.", "Specialist", etc.) (optional)
14. clinicAddress: Full address of the clinic/hospital (optional)
15. visitDate: Date of the medical visit in YYYY-MM-DD format (optional, may differ from receipt date)
16. medicalIssues: Array of medical issues/complaints addressed (e.g., ["headache", "fever"]) (optional)
17. prescriptions: Array of prescribed medications/treatments (optional)
18. recommendations: Additional recommendations from doctor (tests, diet, follow-up) (optional)
19. claimType: Type of medical claim (e.g., "Medical Consultation", "Dental Treatment", "Vision Care") (optional)
20. attachmentDescriptions: Array describing each document type you received (e.g., ["Medical invoice", "Doctor's summary", "Medicine list"]) (optional)

IMPORTANT INSTRUCTIONS:
- Try to identify who the insured person is from the documents (look for patient name)
- Understand what the claim is about by reading all medical information
- Combine information from ALL documents - don't ignore any image
- If information appears in multiple documents, use the most complete/accurate version
- For lineItems, include ALL items from ALL receipts/invoices
- IMPORTANT: It's okay to omit fields if you cannot extract them - return only the fields you can confidently extract
- If you cannot determine a value, it's better to omit the field entirely than to guess
- Return ONLY valid JSON with no additional text before or after
- The system will provide sensible defaults for any missing fields

Example format (you can omit fields you cannot extract):
{
  "retailerName": "City Medical Center",
  "serviceDescription": "Medical consultation and treatment",
  "receiptDate": "2025-01-15",
  "totalAmount": 350.00,
  "paymentMethod": "CREDIT_CARD",
  "lineItems": [
    {
      "description": "Medical consultation",
      "amount": 200.00
    },
    {
      "description": "Blood test",
      "amount": 150.00
    }
  ],
  "extractionConfidence": 85
}

Minimal example (only required info):
{
  "retailerName": "Medical Clinic",
  "totalAmount": 100.00
}`;
  }

  /**
   * Build prompt for claim email generation with detailed health insurance template
   */
  private buildClaimEmailPrompt(
    receiptData: ExtractedReceiptData,
    insuredPersonName: string,
    policyNumber: string,
    insurerName: string,
    dateOfBirth?: string,
    templatePrompt?: string
  ): string {
    // Build prescription/treatment list
    const prescriptionsList = receiptData.prescriptions && receiptData.prescriptions.length > 0
      ? receiptData.prescriptions.map((p) => `• ${p}`).join('\n')
      : receiptData.lineItems.map((item) => `• ${item.description}`).join('\n');

    // Build medical issues list
    const medicalIssuesList = receiptData.medicalIssues && receiptData.medicalIssues.length > 0
      ? receiptData.medicalIssues.join(', ')
      : receiptData.serviceDescription;

    // Build attachments list
    const attachmentsList = receiptData.attachmentDescriptions && receiptData.attachmentDescriptions.length > 0
      ? receiptData.attachmentDescriptions.map((a) => `• ${a}`).join('\n')
      : '• Medical invoice\n• Receipt';

    const baseInstructions = `Generate a professional health insurance claim email.

Claim Information:
- Insured Person: ${insuredPersonName}
${dateOfBirth ? `- Date of Birth: ${dateOfBirth}` : ''}
- Card/Policy ID: ${policyNumber}
- Insurance Company: ${insurerName}
- Claim Type: ${receiptData.claimType || 'Medical Consultation'}
- Service Provider: ${receiptData.retailerName}
${receiptData.doctorName ? `- Doctor: ${receiptData.doctorTitle || 'Dr.'} ${receiptData.doctorName}` : ''}
${receiptData.clinicAddress ? `- Clinic Address: ${receiptData.clinicAddress}` : ''}
- Visit Date: ${receiptData.visitDate || receiptData.receiptDate}
- Medical Issues: ${medicalIssuesList}
- Total Amount: ${receiptData.currency} ${receiptData.totalAmount.toFixed(2)}

Treatments/Prescriptions:
${prescriptionsList}

${receiptData.recommendations ? `Recommendations: ${receiptData.recommendations}` : ''}

Attachments:
${attachmentsList}`;

    // If custom template is provided, use it
    if (templatePrompt && templatePrompt.trim().length > 0) {
      return `${baseInstructions}

SPECIFIC REQUIREMENTS FOR ${insurerName}:
${templatePrompt}

Return the email in this exact format:
Subject: [appropriate subject line]

[email body]`;
    }

    // Otherwise, use the detailed default health insurance template
    const defaultTemplate = `
Use the following DEFAULT template format. This is a professional health insurance claim email template that must be followed:

Email Subject: Health Insurance Claim – ${receiptData.claimType || 'Medical Consultation'} – ${insuredPersonName} – ${policyNumber}

Hello,

Attached are the receipts and medical documentation for my health insurance claim.

Description: ${receiptData.claimType || 'Medical Consultation'}
Full Name: ${insuredPersonName}
${dateOfBirth ? `Date of Birth: ${dateOfBirth}` : 'Date of Birth: [Please fill if available]'}
Card ID: ${policyNumber}
Total Sum: ${receiptData.currency} ${receiptData.totalAmount.toFixed(2)}

I am submitting this claim for reimbursement of expenses incurred for ${receiptData.doctorName ? `a medical consultation with ${receiptData.doctorTitle || 'Dr.'} ${receiptData.doctorName}` : `medical services at ${receiptData.retailerName}`}.

${receiptData.visitDate || receiptData.clinicAddress ? `The consultation took place on ${receiptData.visitDate || receiptData.receiptDate}${receiptData.clinicAddress ? ` at ${receiptData.clinicAddress}` : ''}.` : ''}${receiptData.medicalIssues && receiptData.medicalIssues.length > 0 ? ` The visit addressed: ${medicalIssuesList}.` : ''}

${receiptData.prescriptions && receiptData.prescriptions.length > 0 || receiptData.lineItems.length > 0 ? 'Following evaluation, the doctor prescribed:\n\n' + prescriptionsList : ''}

${receiptData.recommendations ? `\nAdditional recommendations: ${receiptData.recommendations}` : ''}

Attached are:
${attachmentsList}

Total claim amount: ${receiptData.currency} ${receiptData.totalAmount.toFixed(2)}

Best regards,
${insuredPersonName}`;

    return `${baseInstructions}${defaultTemplate}

Generate the email following the DEFAULT template structure shown above. Ensure you maintain the exact format and structure. Return in this format:
Email Subject: [subject line exactly as shown in template]

[email body exactly as shown in template, with all the details filled in]`;
  }

  /**
   * Test connection to Gemini API
   */
  async testConnection(): Promise<boolean> {
    try {
      // No retry for test connection
      const result = await this.model.generateContent('Hello, can you respond?');
      const response = await result.response;
      return response.text().length > 0;
    } catch (error) {
      return false;
    }
  }
}
