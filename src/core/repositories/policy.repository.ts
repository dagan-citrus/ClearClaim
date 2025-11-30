/**
 * Repository for UserPolicy entities
 */

import { BaseRepository } from '@infrastructure/database/base-repository';
import { UserPolicy, PolicyType, UUID } from '@core/types';
import { DocumentData, orderBy, where } from 'firebase/firestore';

/**
 * Repository for managing UserPolicy entities in Firestore
 */
export class PolicyRepository extends BaseRepository<UserPolicy> {
  constructor() {
    super('policies');
  }

  protected fromFirestore(id: string, data: DocumentData): UserPolicy {
    return {
      policyId: id,
      personId: data.personId,
      insurerId: data.insurerId,
      policyType: data.policyType as PolicyType,
      policyNumber: data.policyNumber,
      isDefault: data.isDefault || false,
      createdAt: this.fromFirestoreTimestamp(data.createdAt),
      updatedAt: this.fromFirestoreTimestamp(data.updatedAt),
    };
  }

  protected toFirestore(entity: Partial<UserPolicy>): DocumentData {
    const data: DocumentData = {};

    if (entity.personId !== undefined) data.personId = entity.personId;
    if (entity.insurerId !== undefined) data.insurerId = entity.insurerId;
    if (entity.policyType !== undefined) data.policyType = entity.policyType;
    if (entity.policyNumber !== undefined) data.policyNumber = entity.policyNumber;
    if (entity.isDefault !== undefined) data.isDefault = entity.isDefault;

    return data;
  }

  /**
   * Find policies by person ID
   */
  async findByPersonId(personId: UUID): Promise<UserPolicy[]> {
    return this.findByField('personId', personId, [orderBy('createdAt', 'desc')]);
  }

  /**
   * Find policies by insurer ID
   */
  async findByInsurerId(insurerId: UUID): Promise<UserPolicy[]> {
    return this.findByField('insurerId', insurerId, [orderBy('createdAt', 'desc')]);
  }

  /**
   * Find default policy for a person
   */
  async findDefaultByPersonId(personId: UUID): Promise<UserPolicy | null> {
    const policies = await this.findAll([
      where('personId', '==', personId),
      where('isDefault', '==', true),
    ]);
    return policies.length > 0 ? policies[0] : null;
  }

  /**
   * Set a policy as default (and unset others for the same person)
   */
  async setAsDefault(policyId: UUID): Promise<void> {
    const policy = await this.findByIdOrThrow(policyId);

    // First, unset all other default policies for this person
    const allPolicies = await this.findByPersonId(policy.personId);
    for (const p of allPolicies) {
      if (p.policyId !== policyId && p.isDefault) {
        await this.update(p.policyId, { isDefault: false } as Partial<UserPolicy>);
      }
    }

    // Then set this policy as default
    await this.update(policyId, { isDefault: true } as Partial<UserPolicy>);
  }

  /**
   * Find policies by person and policy type
   */
  async findByPersonAndType(
    personId: UUID,
    policyType: PolicyType
  ): Promise<UserPolicy[]> {
    return this.findAll([
      where('personId', '==', personId),
      where('policyType', '==', policyType),
    ]);
  }
}
