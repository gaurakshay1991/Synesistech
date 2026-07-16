export const ANALYSIS_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'document_title',
    'document_type',
    'document_summary',
    'overall_risk',
    'overall_score',
    'executive_position',
    'findings',
    'missing_clauses',
    'contradictions',
    'regulatory_touchpoints',
    'scenario_tests',
    'recommended_decision',
    'assumptions_and_limits'
  ],
  properties: {
    document_title: { type: 'string' },
    document_type: { type: 'string' },
    document_summary: { type: 'string' },
    overall_risk: { type: 'string', enum: ['High', 'Medium', 'Low'] },
    overall_score: { type: 'integer', minimum: 0, maximum: 100 },
    executive_position: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id',
          'clause_reference',
          'clause_title',
          'quoted_text',
          'issue',
          'risk_category',
          'risk_level',
          'risk_score',
          'why_risky_for_bank',
          'how_risk_may_materialise',
          'impact',
          'recommended_mitigation',
          'suggested_rewrite',
          'review_owner',
          'priority',
          'confidence',
          'verification_required'
        ],
        properties: {
          id: { type: 'string' },
          clause_reference: { type: 'string' },
          clause_title: { type: 'string' },
          quoted_text: { type: 'string' },
          issue: { type: 'string' },
          risk_category: {
            type: 'string',
            enum: ['Legal', 'Regulatory', 'Data Privacy', 'Cybersecurity', 'Operational', 'Financial', 'Reputational', 'KYC/AML', 'Commercial', 'Enforcement']
          },
          risk_level: { type: 'string', enum: ['High', 'Medium', 'Low'] },
          risk_score: { type: 'integer', minimum: 0, maximum: 100 },
          why_risky_for_bank: { type: 'string' },
          how_risk_may_materialise: { type: 'string' },
          impact: {
            type: 'object',
            additionalProperties: false,
            required: ['legal', 'regulatory', 'financial', 'operational', 'data_cyber', 'reputational'],
            properties: {
              legal: { type: 'string' },
              regulatory: { type: 'string' },
              financial: { type: 'string' },
              operational: { type: 'string' },
              data_cyber: { type: 'string' },
              reputational: { type: 'string' }
            }
          },
          recommended_mitigation: { type: 'string' },
          suggested_rewrite: { type: 'string' },
          review_owner: {
            type: 'array',
            items: { type: 'string', enum: ['Legal', 'Compliance', 'Cybersecurity', 'KYC/AML', 'Risk', 'Business', 'Operations', 'Management', 'Procurement'] }
          },
          priority: { type: 'string', enum: ['Immediate', 'Before Signing', 'Post-Signing Control', 'Monitor'] },
          confidence: { type: 'integer', minimum: 0, maximum: 100 },
          verification_required: { type: 'boolean' }
        }
      }
    },
    missing_clauses: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['clause', 'risk_level', 'why_needed', 'recommended_language'],
        properties: {
          clause: { type: 'string' },
          risk_level: { type: 'string', enum: ['High', 'Medium', 'Low'] },
          why_needed: { type: 'string' },
          recommended_language: { type: 'string' }
        }
      }
    },
    contradictions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['issue', 'locations', 'risk_level', 'resolution'],
        properties: {
          issue: { type: 'string' },
          locations: { type: 'array', items: { type: 'string' } },
          risk_level: { type: 'string', enum: ['High', 'Medium', 'Low'] },
          resolution: { type: 'string' }
        }
      }
    },
    regulatory_touchpoints: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['area', 'relevance', 'action', 'verification_required'],
        properties: {
          area: { type: 'string' },
          relevance: { type: 'string' },
          action: { type: 'string' },
          verification_required: { type: 'boolean' }
        }
      }
    },
    scenario_tests: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'trigger_from_document', 'event', 'likely_outcome', 'risk_level', 'recommended_control'],
        properties: {
          title: { type: 'string' },
          trigger_from_document: { type: 'string' },
          event: { type: 'string' },
          likely_outcome: { type: 'string' },
          risk_level: { type: 'string', enum: ['High', 'Medium', 'Low'] },
          recommended_control: { type: 'string' }
        }
      }
    },
    recommended_decision: { type: 'string', enum: ['Do Not Sign', 'Sign Only After Material Revision', 'Sign With Limited Amendments', 'Acceptable Subject to Controls'] },
    assumptions_and_limits: { type: 'array', items: { type: 'string' } }
  }
};

