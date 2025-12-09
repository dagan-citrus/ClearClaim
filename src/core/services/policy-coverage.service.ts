/**
 * Policy Coverage Service
 * Tests if a claim is covered by a policy using AI analysis
 */

import { PolicyCoverageTestDTO } from '@core/types';
import { PolicyRepository } from '@core/repositories';
import { ClaimRepository } from '@core/repositories';
import { GeminiService } from '@infrastructure/llm';
import { StorageService } from '@infrastructure/storage';

export class PolicyCoverageService {
  constructor(
    private policyRepository: PolicyRepository,
    private claimRepository: ClaimRepository,
    private geminiService: GeminiService,
    private storageService: StorageService
  ) {}

  /**
   * Test if a claim is covered by a specific policy
   * @param claimId - The claim ID to test
   * @param policyId - The policy ID to test against
   * @returns Coverage test result
   */
  async testCoverage(claimId: string, policyId: string): Promise<PolicyCoverageTestDTO> {
    try {
      // Load the policy
      const policy = await this.policyRepository.findById(policyId);
      if (!policy) {
        throw new Error('Policy not found');
      }

      // Load the claim
      const claim = await this.claimRepository.findById(claimId);
      if (!claim) {
        throw new Error('Claim not found');
      }

      // Get policy document content if available
      let policyContent = '';
      if (policy.policyDocumentURL) {
        try {
          policyContent = await this.storageService.fetchPolicyDocumentContent(
            policy.policyDocumentURL
          );
        } catch (error) {
          console.error('Failed to fetch policy document:', error);
        }
      } else if (policy.policyWebURL) {
        try {
          policyContent = await this.storageService.fetchPolicyDocumentContent(
            policy.policyWebURL
          );
        } catch (error) {
          console.error('Failed to fetch policy from web URL:', error);
        }
      }

      // Prepare claim information
      const claimInfo = {
        claimType: claim.extractedData.claimType || 'Medical Consultation',
        serviceDescription: claim.extractedData.serviceDescription,
        medicalIssues: claim.extractedData.medicalIssues || [],
        totalAmount: claim.extractedData.totalAmount,
        currency: claim.extractedData.currency,
        doctorName: claim.extractedData.doctorName,
        clinicAddress: claim.extractedData.clinicAddress,
        prescriptions: claim.extractedData.prescriptions || [],
      };

      // Build the prompt for AI analysis
      const prompt = this.buildCoverageTestPrompt(
        policy.policyType,
        policy.policyNumber,
        claimInfo,
        policyContent
      );

      // Use Gemini to analyze coverage
      const result = await this.geminiService.analyzePolicyCoverage(prompt);

      return result;
    } catch (error) {
      console.error('Failed to test policy coverage:', error);
      throw new Error('Failed to test policy coverage');
    }
  }

  /**
   * Build the prompt for AI coverage analysis
   */
  private buildCoverageTestPrompt(
    policyType: string,
    policyNumber: string,
    claimInfo: any,
    policyContent: string
  ): string {
    let prompt = `You are an insurance policy expert. Analyze if the following claim is covered by the insurance policy.

POLICY INFORMATION:
- Policy Type: ${policyType}
- Policy Number: ${policyNumber}
`;

    if (policyContent && policyContent.trim()) {
      prompt += `\nPOLICY DOCUMENT CONTENT:\n${policyContent}\n`;
    } else {
      prompt += `\nNote: No policy document is available. Base your analysis on typical ${policyType} insurance coverage.\n`;
    }

    prompt += `\nCLAIM INFORMATION:
- Claim Type: ${claimInfo.claimType}
- Service Description: ${claimInfo.serviceDescription}
- Total Amount: ${claimInfo.currency} ${claimInfo.totalAmount}
`;

    if (claimInfo.medicalIssues && claimInfo.medicalIssues.length > 0) {
      prompt += `- Medical Issues: ${claimInfo.medicalIssues.join(', ')}\n`;
    }

    if (claimInfo.prescriptions && claimInfo.prescriptions.length > 0) {
      prompt += `- Prescriptions: ${claimInfo.prescriptions.join(', ')}\n`;
    }

    if (claimInfo.doctorName) {
      prompt += `- Doctor: ${claimInfo.doctorName}\n`;
    }

    if (claimInfo.clinicAddress) {
      prompt += `- Clinic: ${claimInfo.clinicAddress}\n`;
    }

    prompt += `\nINSTRUCTIONS:
Analyze the claim against the policy and provide your response in the following JSON format ONLY (no other text):

{
  "status": "Covered" | "Not Covered" | "Not Sure",
  "explanation": "Brief explanation of your determination",
  "relevantSections": ["Section reference 1", "Section reference 2"],
  "confidence": 85
}

Guidelines:
- Use "Covered" if the claim clearly falls within the policy coverage
- Use "Not Covered" if the claim clearly does not fall within the policy coverage
- Use "Not Sure" if there is ambiguity or insufficient information
- Provide specific section references if the policy document is available
- Confidence should be 0-100 based on how certain you are
- Keep explanation concise and professional

Respond with ONLY the JSON object, no additional text.`;

    return prompt;
  }
}
