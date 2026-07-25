const EMPLOYMENT_CONTEXT = /\b(employment|employee|candidate|recruit(?:ment|ing)?|hiring|hire|termination of employment|dismissal|disciplin(?:e|ary)|promotion|compensation|salary|performance rating|redundan(?:cy|t)|workforce|human resources|\bhr\b)\b/i;

export const HUMAN_OVERSIGHT_POLICY = Object.freeze({
  mode: 'human-in-the-loop',
  advisoryOnly: true,
  finalDecisionByHuman: true,
  namedReviewerRequired: true,
  recordedRationaleRequired: true,
  emergencyFallbackMayNotBeCompleted: true,
  prohibitedAutonomousEmploymentDecisions: [
    'hiring or candidate rejection',
    'termination, dismissal or redundancy',
    'promotion or demotion',
    'compensation or benefits',
    'disciplinary action',
    'performance rating or ranking'
  ]
});

function compact(value = '', maximum = 500) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maximum);
}

export function classifyProviderError(error = {}) {
  const status = Number(error?.status || error?.response?.status || 0);
  const rawCode = compact(error?.code || error?.error?.code || error?.type || error?.error?.type, 120).toLowerCase();
  const message = compact(error?.message || error?.error?.message || error, 500);
  const searchable = `${rawCode} ${message}`.toLowerCase();

  if (/openai_quota_exceeded|quota_exceeded|insufficient_quota|exceeded.{0,40}quota|billing|credit balance|current quota/.test(searchable)) {
    return {
      code: 'OPENAI_QUOTA_EXCEEDED',
      httpStatus: 503,
      retryable: false,
      userMessage: 'Live analysis was not completed because the OpenAI API project has no usable quota. Add API billing or credits, or replace the key with one from a funded project, then run the analysis again.',
      operatorAction: 'Fund the OpenAI API project or use a key issued by a funded project.'
    };
  }

  if (status === 429 || /rate limit|too many requests|tokens per min|requests per min/.test(searchable)) {
    return {
      code: 'OPENAI_RATE_LIMITED',
      httpStatus: 429,
      retryable: true,
      userMessage: 'Live analysis was not completed because the model provider rate limit was reached. Wait briefly and retry.',
      operatorAction: 'Retry with exponential backoff or increase the project rate limit.'
    };
  }

  if (status === 401 || /invalid api key|incorrect api key|authentication/.test(searchable)) {
    return {
      code: 'OPENAI_AUTHENTICATION_FAILED',
      httpStatus: 503,
      retryable: false,
      userMessage: 'Live analysis was not completed because the configured OpenAI API key was rejected.',
      operatorAction: 'Replace OPENAI_API_KEY with a valid project key and redeploy.'
    };
  }

  if (status === 403 || /permission|not permitted|does not have access/.test(searchable)) {
    return {
      code: 'OPENAI_MODEL_ACCESS_DENIED',
      httpStatus: 503,
      retryable: false,
      userMessage: 'Live analysis was not completed because the API project is not permitted to use the configured model.',
      operatorAction: 'Use a model available to the project or update project permissions.'
    };
  }

  if (status === 404 || /model.{0,30}(not found|does not exist)|unknown model/.test(searchable)) {
    return {
      code: 'OPENAI_MODEL_NOT_FOUND',
      httpStatus: 503,
      retryable: false,
      userMessage: 'Live analysis was not completed because the configured model ID is unavailable.',
      operatorAction: 'Set OPENAI_MODEL to a currently available API model.'
    };
  }

  if (status >= 500 || /timeout|timed out|overloaded|temporarily unavailable|connection/.test(searchable)) {
    return {
      code: 'OPENAI_TEMPORARILY_UNAVAILABLE',
      httpStatus: 503,
      retryable: true,
      userMessage: 'Live analysis was not completed because the model provider was temporarily unavailable. Retry the analysis.',
      operatorAction: 'Retry with bounded exponential backoff.'
    };
  }

  return {
    code: 'OPENAI_ANALYSIS_FAILED',
    httpStatus: 503,
    retryable: false,
    userMessage: 'Live analysis was not completed. The result has not been marked complete or saved as a completed analysis.',
    operatorAction: 'Review provider configuration and runtime logs before retrying.'
  };
}

export function employmentContextDetected(text = '', options = {}) {
  const context = [
    options.documentType,
    options.matter,
    options.workType,
    options.institutionFunction,
    String(text).slice(0, 30000)
  ].filter(Boolean).join(' ');
  return EMPLOYMENT_CONTEXT.test(context);
}

export function applyHumanOversight(analysis = {}, { text = '', options = {} } = {}) {
  const employmentContext = employmentContextDetected(text, options);
  const generalNotice = 'This output is advisory decision support. A named authorised human reviewer must verify the evidence, record rationale and approve every consequential action.';
  const employmentNotice = 'Synesis must not make or execute hiring, rejection, termination, promotion, compensation, disciplinary, redundancy or performance decisions. Those decisions require accountable human judgment under applicable policy and law.';
  const notices = employmentContext ? [generalNotice, employmentNotice] : [generalNotice];
  const limitations = [...new Set([...(analysis.assumptions_and_limits || []), ...notices])];

  return {
    ...analysis,
    ...(employmentContext ? {
      recommended_decision: 'Human Review Required — Advisory Analysis Only',
      executive_position: [analysis.executive_position, employmentNotice].filter(Boolean).join('\n\n')
    } : {}),
    assumptions_and_limits: limitations,
    governance: {
      ...HUMAN_OVERSIGHT_POLICY,
      employmentContextDetected: employmentContext,
      notice: employmentContext ? employmentNotice : generalNotice,
      analysisCompleted: Boolean(analysis.analysis_details?.live_ai_used)
    },
    human_review_required: true
  };
}

export function liveAnalysisFailure(analysis = {}) {
  if (analysis.analysis_details?.live_ai_used) return null;
  return classifyProviderError({
    status: analysis.analysis_details?.provider_status,
    code: analysis.analysis_details?.provider_code,
    message: analysis.analysis_details?.failure || 'Live analysis did not complete.'
  });
}

export function providerFailureResponse(error, model) {
  const structured = error?.code && error?.userMessage && Number.isFinite(Number(error?.httpStatus))
    ? error
    : classifyProviderError(error);
  return {
    status: Number(structured.httpStatus) || 503,
    body: {
      error: structured.userMessage,
      code: structured.code,
      retryable: Boolean(structured.retryable),
      operatorAction: structured.operatorAction,
      analysisCompleted: false,
      fallbackSuppressed: true,
      humanReviewRequired: true,
      model
    }
  };
}
