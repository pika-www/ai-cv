export type Locale = 'zh' | 'en'
export type FlowStep = 'start' | 'profile' | 'job' | 'match' | 'questions' | 'resume' | 'review' | 'export'
export type BulletStatus = 'supported' | 'needs_confirmation' | 'needs_evidence' | 'blocked'
export type ExportFormat = 'plain_text' | 'markdown' | 'pdf'
export type ResumeDirection = 'ats_clarity' | 'business_impact' | 'technical_depth' | 'concise'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'

export class ApiClientError extends Error {
  code: string
  details: string
  recoverable: boolean
  status: number

  constructor(status: number, code: string, error: string, details: string, recoverable: boolean) {
    super(error)
    this.status = status
    this.code = code
    this.details = details
    this.recoverable = recoverable
  }
}

export type HealthResponse = {
  ok: boolean
  service: string
  version: string
  maxRequestBytes: number
  aiProviderConfigured: boolean
}

export type SessionSummary = {
  sessionId: string
  createdAt: string
  updatedAt: string
  locale: Locale
  targetLanguage: Locale
  flowStep: FlowStep
  dataRetentionMode: 'session_only'
}

export type SourceDocument = {
  sourceId: string
  sessionId: string
  sourceType: 'resume_file' | 'resume_text' | 'manual_profile' | 'job_description' | 'follow_up_answer'
  fileName?: string
  mimeType?: string
  textHash: string
  createdAt: string
}

export type EvidenceItem = {
  evidenceId: string
  sessionId: string
  sourceId: string
  evidenceType:
    | 'work_experience'
    | 'project'
    | 'education'
    | 'skill'
    | 'achievement'
    | 'metric'
    | 'responsibility'
    | 'user_answer'
  text: string
  normalizedText: string
  timeRange?: string
  organization?: string
  role?: string
  skills: string[]
  confidence: number
  needsUserConfirmation: boolean
}

export type Profile = {
  profileId: string
  sessionId: string
  evidenceIds: string[]
  confirmedEvidenceIds: string[]
  missingFields: string[]
  completeness: number
  updatedAt: string
}

export type FollowUpQuestion = {
  questionId: string
  sessionId: string
  requirementId?: string
  evidenceIds: string[]
  question: string
  reason: string
  priority: 'high' | 'medium'
  status: 'open' | 'answered' | 'skipped' | 'not_applicable'
}

export type FollowUpAnswer = {
  answerId: string
  questionId: string
  sourceId: string
  answerText: string
  createdEvidenceIds: string[]
  needsUserConfirmation: boolean
  createdAt: string
}

export type JobRequirement = {
  requirementId: string
  jobId: string
  requirementType:
    | 'responsibility'
    | 'hard_skill'
    | 'soft_skill'
    | 'experience'
    | 'domain'
    | 'education'
    | 'nice_to_have'
  text: string
  priority: 'high' | 'medium'
  keywords: string[]
}

export type MatchResult = {
  matchId: string
  requirementId: string
  evidenceIds: string[]
  matchStrength: 'strong' | 'partial' | 'weak' | 'none'
  gapReason?: string
  needsFollowUp: boolean
}

export type SourceReference = {
  sourceRefId: string
  sourceId: string
  evidenceId?: string
  requirementId?: string
  quote: string
  referenceType: 'user_provided' | 'resume_extracted' | 'follow_up_answer' | 'job_requirement' | 'model_inferred'
}

export type Claim = {
  claimId: string
  bulletId: string
  claimText: string
  claimType:
    | 'company'
    | 'title'
    | 'date'
    | 'responsibility'
    | 'tool'
    | 'metric'
    | 'outcome'
    | 'skill'
    | 'domain'
    | 'education'
  sourceRefs: SourceReference[]
  confidence: number
  needsUserConfirmation: boolean
  status: BulletStatus
}

export type GeneratedBullet = {
  bulletId: string
  sessionId: string
  jobId: string
  materialType: 'summary' | 'experience_bullet' | 'project_bullet' | 'skills_line'
  language: Locale
  text: string
  requirementIds: string[]
  claims: Claim[]
  status: BulletStatus
  needsUserConfirmation: boolean
  reviewNote: string
}

export type TraceabilitySummary = {
  profileClaims: number
  jobDescriptionReferences: number
  unsupportedClaims: number
}

export type MaterialSet = {
  materialSetId: string
  sessionId: string
  jobId: string
  title: string
  status: string
  targetLanguage: Locale
  bulletIds: string[]
  bullets: GeneratedBullet[]
  traceability: TraceabilitySummary
  promptVersion: string
  modelProvider: string
  modelName: string
  createdAt: string
}

export type ExportRecord = {
  exportId: string
  sessionId: string
  materialSetId: string
  format: ExportFormat
  includedBulletIds: string[]
  excludedBullets: Array<{
    bulletId: string
    status: BulletStatus
    reason: string
  }>
  fileName: string
  contentType: string
  createdAt: string
}

export type ParseResumeResponse = {
  session: SessionSummary
  sourceDocument: SourceDocument
  profile: Profile
  evidenceItems: EvidenceItem[]
  nextQuestions: FollowUpQuestion[]
}

export type ProfileIntakeResponse = {
  session: SessionSummary
  profileId: string
  completeness: number
  evidenceItems: EvidenceItem[]
  missingEvidence: string[]
  nextQuestions: FollowUpQuestion[]
  profile: Profile
}

export type ProfileQuestionsResponse = {
  session: SessionSummary
  profile: Profile
  createdAnswers: FollowUpAnswer[]
  openQuestions: FollowUpQuestion[]
  evidenceItems: EvidenceItem[]
}

export type JobMatchResponse = {
  session: SessionSummary
  jobId: string
  matchScore: number
  keywordCoverage: number
  strengths: string[]
  gaps: string[]
  atsWarnings: string[]
  requirements: JobRequirement[]
  matches: MatchResult[]
  followUpQuestions: FollowUpQuestion[]
}

export type MaterialSetResponse = {
  materialSet: MaterialSet
}

export type ExportResponse = {
  export: ExportRecord
  fileName: string
  contentType: string
  content?: string
  contentBase64?: string
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...options.headers,
    },
  })

  const text = await response.text()
  const payload = text ? JSON.parse(text) : null

  if (!response.ok) {
    throw new ApiClientError(
      response.status,
      payload?.code ?? 'request_error',
      payload?.error ?? '请求失败',
      payload?.details ?? '后端暂时不可用，请稍后重试。',
      payload?.recoverable ?? true,
    )
  }

  return payload as T
}

export const api = {
  health: () => request<HealthResponse>('/health', { method: 'GET' }),
  createSession: (body: { locale: Locale; targetLanguage: Locale }) =>
    request<{ session: SessionSummary }>('/api/sessions', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  parseResume: (body: {
    sessionId?: string
    locale: Locale
    targetLanguage: Locale
    fileName?: string
    mimeType?: string
    resumeText: string
  }) =>
    request<ParseResumeResponse>('/api/resumes/parse', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  profileIntake: (body: {
    sessionId?: string
    locale: Locale
    targetLanguage: Locale
    resumeText?: string
    answers?: Array<{ questionId: string; answer: string }>
  }) =>
    request<ProfileIntakeResponse>('/api/profile/intake', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  confirmProfile: (profileId: string, body: { sessionId: string; confirmedEvidenceIds: string[] }) =>
    request<{ session: SessionSummary; profile: Profile; evidenceItems: EvidenceItem[] }>(
      `/api/profiles/${profileId}/confirm`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    ),
  answerQuestions: (profileId: string, body: {
    sessionId: string
    answers: Array<{ questionId: string; answer: string; status?: 'answered' | 'skipped' | 'not_applicable' }>
  }) =>
    request<ProfileQuestionsResponse>(`/api/profiles/${profileId}/questions`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  matchJob: (body: {
    sessionId: string
    profileId?: string
    locale: Locale
    targetLanguage: Locale
    companyName?: string
    jobTitle?: string
    jobDescription: string
  }) =>
    request<JobMatchResponse>('/api/jobs/match', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  rematchJob: (jobId: string, body: { sessionId: string; profileId?: string }) =>
    request<JobMatchResponse>(`/api/jobs/${jobId}/match`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  createMaterialSet: (body: {
    sessionId: string
    profileId?: string
    jobId: string
    targetLanguage: Locale
    direction: ResumeDirection
    maxBullets: number
  }) =>
    request<MaterialSetResponse>('/api/material-sets', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  exportMaterial: (body: {
    sessionId: string
    materialSetId: string
    format: ExportFormat
    confirmedBulletIds?: string[]
  }) =>
    request<ExportResponse>('/api/exports', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
}
