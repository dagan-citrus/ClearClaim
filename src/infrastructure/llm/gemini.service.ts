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
  // Medical-specific fields
  doctorName: z.string().optional(),
  doctorTitle: z.string().optional(),
  clinicAddress: z.string().optional(),
  visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  medicalIssues: z.array(z.string()).optional(),
  prescriptions: z.array(z.string()).optional(),
  recommendations: z.string().optional(),
  claimType: z.string().optional(),
  attachmentDescriptions: z.array(z.string()).optional(),
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

      const result = await this.model.generateContent(content);
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

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();

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
- Return ONLY valid JSON with no additional text before or after

Example format:
{
  "retailerName": "City Medical Center",
  "serviceDescription": "Medical consultation and treatment",
  "receiptDate": "2025-01-15",
  "totalAmount": 350.00,
  "currency": "USD",
  "invoiceNumber": "INV-2025-001",
  "policyNumber": "POL123456",
  "paymentMethod": "CREDIT_CARD",
  "lineItems": [
    {
      "description": "Medical consultation - Dr. Smith",
      "amount": 150.00,
      "quantity": 1
    },
    {
      "description": "Blood test",
      "amount": 100.00,
      "quantity": 1
    },
    {
      "description": "Medication - Amoxicillin 500mg",
      "amount": 100.00,
      "quantity": 1
    }
  ],
  "extractionConfidence": 92,
  "doctorName": "Dr. John Smith",
  "doctorTitle": "General Practitioner",
  "clinicAddress": "123 Medical Street, City, State 12345",
  "visitDate": "2025-01-15",
  "medicalIssues": ["Respiratory infection", "Cough"],
  "prescriptions": ["Amoxicillin 500mg - 3 times daily for 7 days", "Rest and hydration"],
  "recommendations": "Follow-up visit in 1 week if symptoms persist",
  "claimType": "Medical Consultation",
  "attachmentDescriptions": ["Medical invoice", "Doctor's summary", "Prescription"]
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
      const result = await this.model.generateContent('Hello, can you respond?');
      const response = await result.response;
      return response.text().length > 0;
    } catch (error) {
      return false;
    }
  }
}
