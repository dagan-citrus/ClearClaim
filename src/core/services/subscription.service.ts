/**
 * Subscription management service
 */

import { config } from '@config/index';
import {
  UUID,
  SubscriptionTier,
  SubscriptionCheckDTO,
  SubscriptionLimitError,
} from '@core/types';
import { UserRepository, InsuredPersonRepository, ClaimRepository } from '@core/repositories';
import { getCurrentBillingPeriod } from '@core/utils';

/**
 * Service for managing subscription tiers and limits
 */
export class SubscriptionService {
  constructor(
    private userRepository: UserRepository,
    private insuredPersonRepository: InsuredPersonRepository,
    private claimRepository: ClaimRepository
  ) {}

  /**
   * Check subscription status and limits for a user
   */
  async checkSubscription(appUserId: UUID): Promise<SubscriptionCheckDTO> {
    const user = await this.userRepository.findByIdOrThrow(appUserId);
    const tier = user.subscriptionTier;

    // Get current usage
    const insuredPersonCount = await this.insuredPersonRepository.countByUserId(appUserId);
    const { periodStart, periodEnd } = getCurrentBillingPeriod();
    const claimsThisMonth = await this.claimRepository.countByUserInPeriod(
      appUserId,
      periodStart,
      periodEnd
    );

    // Get limits based on tier
    const limits = this.getLimitsForTier(tier);

    // Check if user can add more persons
    const canAddPerson =
      limits.maxInsuredPersons === null ||
      insuredPersonCount < limits.maxInsuredPersons;

    // Check if user can submit more claims
    const canSubmitClaim =
      limits.maxClaimsPerMonth === null ||
      claimsThisMonth < limits.maxClaimsPerMonth;

    const requiresUpgrade = !canAddPerson || !canSubmitClaim;

    return {
      canAddPerson,
      canSubmitClaim,
      currentTier: tier,
      insuredPersonCount,
      insuredPersonLimit: limits.maxInsuredPersons,
      claimsThisMonth,
      claimsMonthlyLimit: limits.maxClaimsPerMonth,
      requiresUpgrade,
    };
  }

  /**
   * Enforce person creation limit
   */
  async enforcePersonCreationLimit(appUserId: UUID): Promise<void> {
    const check = await this.checkSubscription(appUserId);

    if (!check.canAddPerson) {
      throw new SubscriptionLimitError(
        `You have reached the limit of ${check.insuredPersonLimit} insured person(s) for the ${check.currentTier} plan. Please upgrade to add more people.`,
        'PERSON_LIMIT'
      );
    }
  }

  /**
   * Enforce claim submission limit
   */
  async enforceClaimSubmissionLimit(appUserId: UUID): Promise<void> {
    const check = await this.checkSubscription(appUserId);

    if (!check.canSubmitClaim) {
      throw new SubscriptionLimitError(
        `You have reached the limit of ${check.claimsMonthlyLimit} claims per month for the ${check.currentTier} plan. Please upgrade for unlimited claims.`,
        'CLAIM_LIMIT'
      );
    }
  }

  /**
   * Upgrade user to paid tier
   */
  async upgradeToPaid(appUserId: UUID): Promise<void> {
    await this.userRepository.updateSubscriptionTier(appUserId, SubscriptionTier.PAID);
  }

  /**
   * Downgrade user to free tier
   */
  async downgradeToFree(appUserId: UUID): Promise<void> {
    await this.userRepository.updateSubscriptionTier(appUserId, SubscriptionTier.FREE);
  }

  /**
   * Get subscription limits for a tier
   */
  private getLimitsForTier(tier: SubscriptionTier): {
    maxInsuredPersons: number | null;
    maxClaimsPerMonth: number | null;
  } {
    if (tier === SubscriptionTier.FREE) {
      return {
        maxInsuredPersons: config.subscription.free.maxInsuredPersons,
        maxClaimsPerMonth: config.subscription.free.maxClaimsPerMonth,
      };
    } else {
      return {
        maxInsuredPersons: config.subscription.paid.maxInsuredPersons,
        maxClaimsPerMonth: config.subscription.paid.maxClaimsPerMonth,
      };
    }
  }

  /**
   * Get usage statistics for a user
   */
  async getUsageStats(appUserId: UUID): Promise<{
    insuredPersons: number;
    claimsThisMonth: number;
    claimsAllTime: number;
  }> {
    const { periodStart, periodEnd } = getCurrentBillingPeriod();

    const [insuredPersons, claimsThisMonth, allClaims] = await Promise.all([
      this.insuredPersonRepository.countByUserId(appUserId),
      this.claimRepository.countByUserInPeriod(appUserId, periodStart, periodEnd),
      this.claimRepository.findByUserId(appUserId),
    ]);

    return {
      insuredPersons,
      claimsThisMonth,
      claimsAllTime: Array.isArray(allClaims) ? allClaims.length : 0,
    };
  }
}
