export class FlowMindError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'FlowMindError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class AuthError extends FlowMindError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'AUTH_ERROR', 401, details);
    this.name = 'AuthError';
  }
}

export class ValidationError extends FlowMindError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends FlowMindError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'NOT_FOUND', 404, details);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends FlowMindError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONFLICT', 409, details);
    this.name = 'ConflictError';
  }
}

export class ScriptExecutionError extends FlowMindError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'SCRIPT_ERROR', 400, details);
    this.name = 'ScriptExecutionError';
  }
}

export class DagError extends FlowMindError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'DAG_ERROR', 400, details);
    this.name = 'DagError';
  }
}

export class AgentError extends FlowMindError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'AGENT_ERROR', 500, details);
    this.name = 'AgentError';
  }
}

export class BlueprintError extends FlowMindError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'FLOWMIND_ERROR', 400, details);
    this.name = 'BlueprintError';
  }
}
