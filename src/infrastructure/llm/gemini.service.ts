/**
 * Gemini LLM service for OCR and data extraction
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '@config/index';
import {
  ExtractedReceiptData,
  PaymentMethod,
  LLMProcessingError,
  ISODateString,
} from '@core/types';
import { z } from 'zod';

/**
 * Schema for receipt data extraction
 */
const receiptDataSchema = z.object({
  retailerName: z.string().min(1, 'Retailer name is required'),
  serviceDescription: z.string().min(1, 'Service description is required'),
  receiptDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  totalAmount: z.number().positive('Total amount must be positive'),
  currency: z.string().default('USD'),
  invoiceNumber: z.string().optional(),
  receiptNumber: z.string().optional(),
  policyNumber: z.string().optional(),
  paymentMethod: z.nativeEnum(PaymentMethod),
  lineItems: z
    .array(
      z.object({
        description: z.string(),
        amount: z.number().positive(),
        quantity: z.number().optional(),
      })
    )
    .min(1, 'At least one line item is required'),
  extractionConfidence: z.number().min(0).max(100),
});

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
   * Extract receipt data from image
   */
  async extractReceiptData(
    imageData: string,
    imageType: string
  ): Promise<ExtractedReceiptData> {
    try {
      const prompt = this.buildExtractionPrompt();

      // Remove data URL prefix if present
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');

      const result = await this.model.generateContent([
        prompt,
        {
          inlineData: {
            data: base64Data,
            mimeType: imageType,
          },
        },
      ]);

      const response = await result.response;
      const text = response.text();

      // Parse JSON response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new LLMProcessingError('Failed to extract JSON from LLM response');
      }

      const parsedData = JSON.parse(jsonMatch[0]);
      const validatedData = receiptDataSchema.parse(parsedData);

      return {
        ...validatedData,
        lineItems: validatedData.lineItems.map((item) => ({
          ...item,
          personId: undefined,
        })),
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new LLMProcessingError(
          `Receipt data validation failed: ${error.errors.map((e) => e.message).join(', ')}`
        );
      }
      throw new LLMProcessingError(
        `Failed to extract receipt data: ${error instanceof Error ? error.message : 'Unknown error'}`
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
    templatePrompt?: string
  ): Promise<{ subject: string; body: string }> {
    try {
      const prompt = this.buildClaimEmailPrompt(
        receiptData,
        insuredPersonName,
        policyNumber,
        insurerName,
        templatePrompt
      );

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();

      // Extract subject and body
      const subjectMatch = text.match(/Subject:\s*(.+?)(?:\n|$)/i);
      const subject = subjectMatch
        ? subjectMatch[1].trim()
        : `Insurance Claim - Policy ${policyNumber} - ${receiptData.serviceDescription}`;

      // Remove subject line from body if present
      const body = text
        .replace(/Subject:\s*.+?(?:\n|$)/i, '')
        .trim();

      return { subject, body };
    } catch (error) {
      throw new LLMProcessingError(
        `Failed to generate claim email: ${error instanceof Error ? error.message : 'Unknown error'}`
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

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();

      // Extract subject and body
      const subjectMatch = text.match(/Subject:\s*(.+?)(?:\n|$)/i);
      const subject = subjectMatch ? subjectMatch[1].trim() : currentSubject;

      const body = text
        .replace(/Subject:\s*.+?(?:\n|$)/i, '')
        .trim();

      return { subject, body };
    } catch (error) {
      throw new LLMProcessingError(
        `Failed to refine email draft: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Build extraction prompt for receipt OCR
   */
  private buildExtractionPrompt(): string {
    return `You are a receipt OCR expert. Extract all information from this receipt/invoice image and return it as a JSON object.

IMPORTANT: You must return ONLY valid JSON with no additional text before or after.

Extract the following information:
1. retailerName: The name of the business/retailer
2. serviceDescription: Description of the service or product purchased
3. receiptDate: Date of the transaction in YYYY-MM-DD format
4. totalAmount: Total amount paid (as a number, no currency symbols)
5. currency: Currency code (default to "USD" if not specified)
6. invoiceNumber: Invoice number if present (optional)
7. receiptNumber: Receipt number if present (optional)
8. policyNumber: Insurance policy/member number if visible on receipt (optional)
9. paymentMethod: One of: CASH, CREDIT_CARD, DEBIT_CARD, CHECK, BANK_TRANSFER, OTHER
10. lineItems: Array of line items, each with:
   - description: Item/service description
   - amount: Item amount (as a number)
   - quantity: Quantity if specified (optional)
11. extractionConfidence: Your confidence level in the extraction (0-100)

Return ONLY the JSON object with these fields. Example format:
{
  "retailerName": "ABC Dental Clinic",
  "serviceDescription": "Routine dental cleaning and checkup",
  "receiptDate": "2025-01-15",
  "totalAmount": 250.00,
  "currency": "USD",
  "receiptNumber": "REC-2025-001",
  "paymentMethod": "CREDIT_CARD",
  "lineItems": [
    {
      "description": "Dental cleaning",
      "amount": 150.00,
      "quantity": 1
    },
    {
      "description": "Checkup",
      "amount": 100.00,
      "quantity": 1
    }
  ],
  "extractionConfidence": 95
}`;
  }

  /**
   * Build prompt for claim email generation
   */
  private buildClaimEmailPrompt(
    receiptData: ExtractedReceiptData,
    insuredPersonName: string,
    policyNumber: string,
    insurerName: string,
    templatePrompt?: string
  ): string {
    const lineItemsText = receiptData.lineItems
      .map(
        (item, idx) =>
          `${idx + 1}. ${item.description} - ${receiptData.currency} ${item.amount.toFixed(2)}`
      )
      .join('\n');

    const baseInstructions = `Generate a professional insurance claim email for submission.

Claim Details:
- Insured Person: ${insuredPersonName}
- Policy Number: ${policyNumber}
- Insurance Company: ${insurerName}
- Service Provider: ${receiptData.retailerName}
- Service Description: ${receiptData.serviceDescription}
- Date of Service: ${receiptData.receiptDate}
- Total Amount: ${receiptData.currency} ${receiptData.totalAmount.toFixed(2)}
- Payment Method: ${receiptData.paymentMethod}
${receiptData.invoiceNumber ? `- Invoice Number: ${receiptData.invoiceNumber}` : ''}
${receiptData.receiptNumber ? `- Receipt Number: ${receiptData.receiptNumber}` : ''}

Line Items:
${lineItemsText}`;

    const customInstructions = templatePrompt
      ? `\n\nSPECIFIC REQUIREMENTS FOR ${insurerName}:\n${templatePrompt}`
      : '';

    const defaultInstructions = `\n\nGenerate a clear, professional email that:
1. States the purpose (insurance claim submission)
2. Provides all relevant details in an organized format
3. Is polite and professional
4. Mentions that the original receipt/invoice is attached (if applicable)
5. Requests confirmation of receipt and processing`;

    return `${baseInstructions}${customInstructions}${defaultInstructions}

Return the email in this exact format:
Subject: [appropriate subject line]

[email body]`;
  }

  /**
   * Test connection to Gemini API
   */
  async testConnection(): Promise<boolean> {
    try {
      const result = await this.model.generateContent('Hello, can you respond?');
      const response = await result.response;
      return response.text().length > 0;
    } catch (error) {
      return false;
    }
  }
}
