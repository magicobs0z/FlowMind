import { StructuredContract } from './types';
import { logger } from '../../utils/logger';
import { ERROR_CODES } from '../../constants';

class FlowMindError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'FlowMindError';
  }
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface VersionCompatibility {
  compatible: boolean;
  reason?: string;
}

class ContractValidator {
  private contractRegistry = new Map<string, StructuredContract>();

  validateContract(contract: StructuredContract): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!contract.type || !Object.values(['openapi', 'typescript', 'graphql', 'custom']).includes(contract.type)) {
      errors.push('Invalid contract type');
    }

    if (!contract.schema || typeof contract.schema !== 'object') {
      errors.push('Contract schema must be an object');
    }

    if (!contract.version || typeof contract.version !== 'string') {
      errors.push('Contract version must be a string');
    }

    if (!this.isValidVersionFormat(contract.version)) {
      warnings.push('Contract version does not follow semantic versioning');
    }

    switch (contract.type) {
      case 'openapi':
        this.validateOpenAPI(contract, errors, warnings);
        break;
      case 'typescript':
        this.validateTypeScript(contract, errors, warnings);
        break;
      case 'graphql':
        this.validateGraphQL(contract, errors, warnings);
        break;
      case 'custom':
        this.validateCustom(contract, errors, warnings);
        break;
    }

    const result: ValidationResult = {
      isValid: errors.length === 0,
      errors,
      warnings,
    };

    logger.info({ contractType: contract.type, version: contract.version, isValid: result.isValid }, 'Contract validation completed');

    return result;
  }

  checkCompatibility(requestContract?: StructuredContract, responseContract?: StructuredContract): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!requestContract && !responseContract) {
      return { isValid: true, errors: [], warnings: [] };
    }

    if (requestContract && responseContract) {
      if (requestContract.type !== responseContract.type) {
        errors.push(`Contract type mismatch: request=${requestContract.type}, response=${responseContract.type}`);
      }

      const versionCompat = this.checkVersionCompatibility(requestContract.version, responseContract.version);
      if (!versionCompat.compatible) {
        warnings.push(`Version compatibility warning: ${versionCompat.reason}`);
      }

      const schemaCompat = this.checkSchemaCompatibility(requestContract.schema, responseContract.schema);
      if (!schemaCompat.compatible) {
        errors.push(`Schema compatibility issue: ${schemaCompat.reason}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  registerContract(id: string, contract: StructuredContract): void {
    const validation = this.validateContract(contract);
    if (!validation.isValid) {
      throw new FlowMindError(
        ERROR_CODES.CONTRACT_INVALID,
        `Invalid contract: ${validation.errors.join(', ')}`,
        400
      );
    }

    this.contractRegistry.set(id, contract);
    logger.info({ contractId: id, type: contract.type, version: contract.version }, 'Contract registered');
  }

  getContract(id: string): StructuredContract | undefined {
    return this.contractRegistry.get(id);
  }

  getVersionTracking(contractId: string): { version: string; history: string[] } | null {
    const contract = this.contractRegistry.get(contractId);
    if (!contract) return null;

    return {
      version: contract.version,
      history: [contract.version],
    };
  }

  private validateOpenAPI(contract: StructuredContract, errors: string[], warnings: string[]): void {
    const schema = contract.schema as Record<string, unknown>;
    if (!schema.openapi && !schema.swagger) {
      errors.push('OpenAPI contract must contain openapi or swagger property');
    }
    if (!schema.info) {
      errors.push('OpenAPI contract must contain info property');
    }
    if (!schema.paths) {
      warnings.push('OpenAPI contract has no paths defined');
    }
  }

  private validateTypeScript(contract: StructuredContract, errors: string[], _warnings: string[]): void {
    const schema = contract.schema as Record<string, unknown>;
    if (!schema.types && !schema.interfaces) {
      errors.push('TypeScript contract must contain types or interfaces');
    }
  }

  private validateGraphQL(contract: StructuredContract, errors: string[], _warnings: string[]): void {
    const schema = contract.schema as Record<string, unknown>;
    if (!schema.query && !schema.mutation && !schema.subscription) {
      errors.push('GraphQL contract must contain at least one of: query, mutation, subscription');
    }
  }

  private validateCustom(contract: StructuredContract, _errors: string[], _warnings: string[]): void {
    const schema = contract.schema as Record<string, unknown>;
    if (Object.keys(schema).length === 0) {
      _warnings.push('Custom contract schema is empty');
    }
  }

  private isValidVersionFormat(version: string): boolean {
    const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$/;
    return semverRegex.test(version);
  }

  private checkVersionCompatibility(reqVersion: string, resVersion: string): VersionCompatibility {
    const reqParts = reqVersion.split('.')[0];
    const resParts = resVersion.split('.')[0];

    if (reqParts === resParts) {
      return { compatible: true };
    }

    return {
      compatible: false,
      reason: `Major version mismatch: request=${reqVersion}, response=${resVersion}`,
    };
  }

  private checkSchemaCompatibility(reqSchema: Record<string, unknown>, resSchema: Record<string, unknown>): { compatible: boolean; reason?: string } {
    const reqKeys = new Set(Object.keys(reqSchema));
    const resKeys = new Set(Object.keys(resSchema));

    const missingInResponse = [...reqKeys].filter((k) => !resKeys.has(k));
    if (missingInResponse.length > 0) {
      return {
        compatible: false,
        reason: `Missing fields in response: ${missingInResponse.join(', ')}`,
      };
    }

    return { compatible: true };
  }
}

export const contractValidator = new ContractValidator();
