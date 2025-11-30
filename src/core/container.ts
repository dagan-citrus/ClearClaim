/**
 * Dependency injection container for services
 */

import { UserRepository, InsuredPersonRepository, InsurerRepository, PolicyRepository, ClaimRepository } from './repositories';
import { SubscriptionService, ClaimProcessorService, ClaimGeneratorService, OneClickClaimService } from './services';
import { AuthService } from '@infrastructure/auth';
import { GeminiService } from '@infrastructure/llm';

/**
 * Service container class
 */
class ServiceContainer {
  // Repositories
  private _userRepository?: UserRepository;
  private _insuredPersonRepository?: InsuredPersonRepository;
  private _insurerRepository?: InsurerRepository;
  private _policyRepository?: PolicyRepository;
  private _claimRepository?: ClaimRepository;

  // Infrastructure services
  private _authService?: AuthService;
  private _geminiService?: GeminiService;

  // Business services
  private _subscriptionService?: SubscriptionService;
  private _claimProcessorService?: ClaimProcessorService;
  private _claimGeneratorService?: ClaimGeneratorService;
  private _oneClickClaimService?: OneClickClaimService;

  // Repositories
  get userRepository(): UserRepository {
    if (!this._userRepository) {
      this._userRepository = new UserRepository();
    }
    return this._userRepository;
  }

  get insuredPersonRepository(): InsuredPersonRepository {
    if (!this._insuredPersonRepository) {
      this._insuredPersonRepository = new InsuredPersonRepository();
    }
    return this._insuredPersonRepository;
  }

  get insurerRepository(): InsurerRepository {
    if (!this._insurerRepository) {
      this._insurerRepository = new InsurerRepository();
    }
    return this._insurerRepository;
  }

  get policyRepository(): PolicyRepository {
    if (!this._policyRepository) {
      this._policyRepository = new PolicyRepository();
    }
    return this._policyRepository;
  }

  get claimRepository(): ClaimRepository {
    if (!this._claimRepository) {
      this._claimRepository = new ClaimRepository();
    }
    return this._claimRepository;
  }

  // Infrastructure services
  get authService(): AuthService {
    if (!this._authService) {
      this._authService = new AuthService(this.userRepository);
    }
    return this._authService;
  }

  get geminiService(): GeminiService {
    if (!this._geminiService) {
      this._geminiService = new GeminiService();
    }
    return this._geminiService;
  }

  // Business services
  get subscriptionService(): SubscriptionService {
    if (!this._subscriptionService) {
      this._subscriptionService = new SubscriptionService(
        this.userRepository,
        this.insuredPersonRepository,
        this.claimRepository
      );
    }
    return this._subscriptionService;
  }

  get claimProcessorService(): ClaimProcessorService {
    if (!this._claimProcessorService) {
      this._claimProcessorService = new ClaimProcessorService(
        this.claimRepository,
        this.insuredPersonRepository,
        this.policyRepository,
        this.insurerRepository,
        this.geminiService,
        this.subscriptionService
      );
    }
    return this._claimProcessorService;
  }

  get claimGeneratorService(): ClaimGeneratorService {
    if (!this._claimGeneratorService) {
      this._claimGeneratorService = new ClaimGeneratorService(
        this.claimRepository,
        this.insuredPersonRepository,
        this.policyRepository,
        this.insurerRepository,
        this.geminiService
      );
    }
    return this._claimGeneratorService;
  }

  get oneClickClaimService(): OneClickClaimService {
    if (!this._oneClickClaimService) {
      this._oneClickClaimService = new OneClickClaimService(
        this.claimProcessorService,
        this.claimGeneratorService
      );
    }
    return this._oneClickClaimService;
  }

  /**
   * Reset all services (useful for testing)
   */
  reset(): void {
    this._userRepository = undefined;
    this._insuredPersonRepository = undefined;
    this._insurerRepository = undefined;
    this._policyRepository = undefined;
    this._claimRepository = undefined;
    this._authService = undefined;
    this._geminiService = undefined;
    this._subscriptionService = undefined;
    this._claimProcessorService = undefined;
    this._claimGeneratorService = undefined;
    this._oneClickClaimService = undefined;
  }
}

/**
 * Singleton service container instance
 */
export const container = new ServiceContainer();
