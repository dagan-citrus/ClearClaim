/**
 * Repository for Insurer entities
 */

import { BaseRepository } from '@infrastructure/database/base-repository';
import { Insurer } from '@core/types';
import { DocumentData, orderBy } from 'firebase/firestore';

/**
 * Repository for managing Insurer entities in Firestore
 */
export class InsurerRepository extends BaseRepository<Insurer> {
  constructor() {
    super('insurers');
  }

  protected fromFirestore(id: string, data: DocumentData): Insurer {
    return {
      insurerId: id,
      insurerName: data.insurerName,
      // Support both claimsEmail and claimsEmailTemplate for backward compatibility
      claimsEmail: data.claimsEmail || data.claimsEmailTemplate || '',
      claimsEmailTemplate: data.claimsEmailTemplate,
      templatePrompt: data.templatePrompt || '', // Default to empty string for backward compatibility
      createdAt: this.fromFirestoreTimestamp(data.createdAt),
      updatedAt: this.fromFirestoreTimestamp(data.updatedAt),
    };
  }

  protected toFirestore(entity: Partial<Insurer>): DocumentData {
    const data: DocumentData = {};

    if (entity.insurerName !== undefined) data.insurerName = entity.insurerName;
    if (entity.claimsEmail !== undefined) data.claimsEmail = entity.claimsEmail;
    if (entity.claimsEmailTemplate !== undefined)
      data.claimsEmailTemplate = entity.claimsEmailTemplate;
    if (entity.templatePrompt !== undefined) data.templatePrompt = entity.templatePrompt;

    return data;
  }

  /**
   * Find all insurers ordered by name
   */
  async findAllOrdered(): Promise<Insurer[]> {
    return this.findAll([orderBy('insurerName', 'asc')]);
  }

  /**
   * Find insurer by name
   */
  async findByName(insurerName: string): Promise<Insurer | null> {
    const insurers = await this.findByField('insurerName', insurerName);
    return insurers.length > 0 ? insurers[0] : null;
  }

  /**
   * Search insurers by name (case-insensitive prefix match)
   */
  async searchByName(searchTerm: string): Promise<Insurer[]> {
    const allInsurers = await this.findAllOrdered();
    const lowerSearch = searchTerm.toLowerCase();
    return allInsurers.filter((insurer) =>
      insurer.insurerName.toLowerCase().includes(lowerSearch)
    );
  }
}
