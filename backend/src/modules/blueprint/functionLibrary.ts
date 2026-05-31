import { BlueprintFunction, BlueprintNode } from './types';
import { logger } from '../../utils/logger';

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function createNode(
  type: BlueprintNode['type'],
  title: string,
  description: string,
  dependencies: string[],
  config: Record<string, unknown> = {},
  agentType?: string
): BlueprintNode {
  const id = generateId('node');
  return {
    id,
    type,
    title,
    description,
    agentType,
    status: 'pending',
    dependencies,
    config,
    input: {},
    output: {},
  };
}

const gitFeatureBranch: BlueprintFunction = {
  id: 'func_git_feature_branch',
  name: 'gitFeatureBranch',
  description: 'Git feature branch workflow: create branch, develop, test, and merge',
  category: 'git',
  template: [
    createNode('agent', 'Create Feature Branch', 'Create a new feature branch from main', [], {
      command: 'git checkout -b',
    }),
    createNode('script', 'Implement Feature', 'Develop the feature on the branch', [
      'node_Create Feature Branch',
    ], {
      command: 'implement',
    }),
    createNode('script', 'Run Tests', 'Run unit and integration tests', [
      'node_Implement Feature',
    ], {
      command: 'npm test',
    }),
    createNode('gateway', 'Code Review', 'Peer review of the feature implementation', [
      'node_Run Tests',
    ], {}, 'reviewer'),
    createNode('agent', 'Address Review Feedback', 'Fix issues identified in code review', [
      'node_Code Review',
    ], {
      command: 'review_fix',
    }),
    createNode('gateway', 'Final Approval', 'Final approval before merge', [
      'node_Address Review Feedback',
    ], {}, 'reviewer'),
    createNode('script', 'Merge to Main', 'Merge feature branch into main', [
      'node_Final Approval',
    ], {
      command: 'git merge',
    }),
  ],
  parameters: {
    branchName: { type: 'string', required: true },
    baseBranch: { type: 'string', required: false, default: 'main' },
    reviewers: { type: 'array', required: false, default: [] },
    autoMerge: { type: 'boolean', required: false, default: false },
  },
};

const apiContractNegotation: BlueprintFunction = {
  id: 'func_api_contract_negotiation',
  name: 'apiContractNegotation',
  description: 'API contract negotiation pattern: design, review, implement, and validate API',
  category: 'api',
  template: [
    createNode('agent', 'Design API Spec', 'Create initial API specification', [], {
      command: 'api_design',
    }),
    createNode('gateway', 'API Review', 'Review API spec with stakeholders', [
      'node_Design API Spec',
    ], {}, 'reviewer'),
    createNode('agent', 'Generate Mock Server', 'Generate mock server from API spec', [
      'node_API Review',
    ], {
      command: 'mock_gen',
    }),
    createNode('script', 'Implement API', 'Implement API endpoints', [
      'node_Generate Mock Server',
    ], {
      command: 'implement_api',
    }),
    createNode('script', 'Contract Validation', 'Validate implementation against spec', [
      'node_Implement API',
    ], {
      command: 'validate_contract',
    }),
    createNode('gateway', 'Stakeholder Sign-off', 'Final sign-off from stakeholders', [
      'node_Contract Validation',
    ], {}, 'reviewer'),
  ],
  parameters: {
    apiVersion: { type: 'string', required: true },
    specFormat: { type: 'string', required: false, default: 'openapi3' },
    endpoints: { type: 'array', required: true },
    authentication: { type: 'string', required: false, default: 'bearer' },
  },
};

const codeReviewCycle: BlueprintFunction = {
  id: 'func_code_review_cycle',
  name: 'codeReviewCycle',
  description: 'Code review loop: submit review, address feedback, re-review until approval',
  category: 'review',
  template: [
    createNode('script', 'Submit Code for Review', 'Create PR and notify reviewers', [], {
      command: 'create_pr',
    }),
    createNode('gateway', 'Initial Review', 'First pass code review', [
      'node_Submit Code for Review',
    ], {}, 'reviewer'),
    createNode('condition', 'Review Decision', 'Check if review is approved or needs changes', [
      'node_Initial Review',
    ], {
      expression: 'review_status',
    }),
    createNode('agent', 'Address Feedback', 'Implement reviewer feedback', [
      'node_Review Decision',
    ], {
      command: 'fix_feedback',
      condition: 'rejected',
    }),
    createNode('script', 'Re-run Tests', 'Run tests after changes', [
      'node_Address Feedback',
    ], {
      command: 'npm test',
    }),
    createNode('gateway', 'Re-review', 'Second pass review after changes', [
      'node_Re-run Tests',
    ], {}, 'reviewer'),
    createNode('script', 'Merge PR', 'Merge approved PR', [
      'node_Review Decision',
    ], {
      command: 'merge_pr',
      condition: 'approved',
    }),
  ],
  parameters: {
    prUrl: { type: 'string', required: true },
    reviewers: { type: 'array', required: true },
    maxReviewCycles: { type: 'number', required: false, default: 3 },
    autoApproveLint: { type: 'boolean', required: false, default: true },
  },
};

const deployPipeline: BlueprintFunction = {
  id: 'func_deploy_pipeline',
  name: 'deployPipeline',
  description: 'Deployment pipeline: build, test, deploy to staging, approve, deploy to production',
  category: 'deploy',
  template: [
    createNode('script', 'Build Application', 'Build application artifacts', [], {
      command: 'npm run build',
    }),
    createNode('script', 'Run Pre-deploy Tests', 'Run full test suite before deployment', [
      'node_Build Application',
    ], {
      command: 'npm test',
    }),
    createNode('script', 'Deploy to Staging', 'Deploy to staging environment', [
      'node_Run Pre-deploy Tests',
    ], {
      environment: 'staging',
    }),
    createNode('script', 'Run Smoke Tests', 'Run smoke tests on staging', [
      'node_Deploy to Staging',
    ], {
      command: 'smoke_test',
    }),
    createNode('gateway', 'Deployment Approval', 'Approve deployment to production', [
      'node_Run Smoke Tests',
    ], {}, 'reviewer'),
    createNode('script', 'Deploy to Production', 'Deploy to production environment', [
      'node_Deployment Approval',
    ], {
      environment: 'production',
    }),
    createNode('gateway', 'Post-deploy Verification', 'Verify deployment success', [
      'node_Deploy to Production',
    ], {}, 'reviewer'),
  ],
  parameters: {
    stagingEnv: { type: 'string', required: false, default: 'staging' },
    productionEnv: { type: 'string', required: false, default: 'production' },
    rollbackOnFailure: { type: 'boolean', required: false, default: true },
    notificationChannel: { type: 'string', required: false, default: '#deployments' },
  },
};

const functionLibrary: BlueprintFunction[] = [
  gitFeatureBranch,
  apiContractNegotation,
  codeReviewCycle,
  deployPipeline,
];

function getFunctionByName(name: string): BlueprintFunction | undefined {
  const fn = functionLibrary.find((f) => f.name === name);
  if (!fn) {
    logger.warn({ functionName: name }, 'Blueprint function not found');
  }
  return fn;
}

function getFunctionsByCategory(category: BlueprintFunction['category']): BlueprintFunction[] {
  return functionLibrary.filter((f) => f.category === category);
}

export {
  gitFeatureBranch,
  apiContractNegotation,
  codeReviewCycle,
  deployPipeline,
  functionLibrary,
  getFunctionByName,
  getFunctionsByCategory,
};
