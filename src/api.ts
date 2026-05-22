export type Locale = 'zh' | 'en'
export type FlowStep = 'start' | 'profile' | 'job' | 'match' | 'questions' | 'resume' | 'review' | 'export'
export type BulletStatus = 'supported' | 'needs_confirmation' | 'needs_evidence' | 'blocked'
export type ExportFormat = 'plain_text' | 'markdown' | 'pdf'
export type ResumeDirection = 'ats_clarity' | 'business_impact' | 'technical_depth' | 'concise'
export type ResumeSectionType =
  | 'basic_info'
  | 'summary'
  | 'education'
  | 'work_experience'
  | 'project_experience'
  | 'skills'
  | 'certifications'
  | 'additional'
export type ResumeSectionStatus = 'normal' | 'needs_review' | 'empty' | 'hidden'
export type ResumeItemType = 'field' | 'paragraph' | 'list_item' | 'experience_entry' | 'skill_group'
export type ResumeItemSource = 'uploaded_resume' | 'pasted_resume' | 'manual_edit' | 'ai_suggestion_applied' | 'new_experience_inserted'
export type ResumeItemStatus = 'normal' | 'needs_review' | 'empty' | 'hidden'
export type ResumeModuleType = ResumeSectionType | 'unknown'
export type ResumeModuleStatus = 'normal' | 'needs_review' | 'analyzing' | 'has_suggestions' | 'applied' | 'ignored' | 'unknown'
export type RiskLevel = 'low' | 'medium' | 'high'
export type SuggestionStatus = 'open' | 'applied' | 'ignored' | 'edited_by_user' | 'blocked'
export type SuggestionSource = 'ai_provider' | 'local_development_fallback'
export type AnalysisScope = 'document' | 'module'
export type ProviderInteractionMode = 'chat_messages' | 'structured_json'
export type SuggestionExtractionStatus = 'succeeded' | 'partial' | 'failed'
export type SuggestedOperation =
  | 'rewrite_in_place'
  | 'split_into_bullets'
  | 'move_to_module'
  | 'split_module'
  | 'merge_with_module'
  | 'delete_from_module'
export type InsertPosition = 'end'
export type InsertProposalStatus = 'proposed' | 'accepted' | 'edited' | 'rejected' | 'blocked'
export type AiKeyMode = 'owner_default' | 'user_session_key' | 'not_configured'
export type AiWireApi = 'responses' | 'chat_completions'
export type AiResponseFormat = 'auto' | 'json_schema' | 'json_object' | 'plain_json'
export type AiCapabilityStatus = 'full' | 'basic' | 'unsupported' | 'unknown'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:4000'
const ACCESS_TOKEN_STORAGE_KEY = 'ai-cv-access-token'
let runtimeAccessToken = getInitialAccessToken()

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

export function setAccessToken(token: string) {
  const normalized = token.trim()
  runtimeAccessToken = normalized || undefined
  if (normalized) {
    window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, normalized)
  } else {
    window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY)
  }
}

export function hasAccessToken() {
  return Boolean(runtimeAccessToken)
}

function loadStoredAccessToken() {
  if (typeof window === 'undefined') return undefined
  return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)?.trim() || undefined
}

function getInitialAccessToken() {
  return import.meta.env.VITE_APP_ACCESS_TOKEN?.trim() || loadStoredAccessToken()
}

export type HealthResponse = {
  ok: boolean
  service: string
  version: string
  maxRequestBytes: number
  aiProviderConfigured: boolean
  userAiKeySupported?: boolean
  aiAnalysisRequired?: boolean
  aiAnalysisAvailable?: boolean
  accessControlRequired?: boolean
  acceptedAuthHeaders?: string[]
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

export type ResumeItem = {
  itemId: string
  sectionId: string
  itemType: ResumeItemType
  text: string
  fields: Record<string, string>
  order: number
  source: ResumeItemSource
  status: ResumeItemStatus
}

export type ResumeSection = {
  sectionId: string
  documentId: string
  sectionType: ResumeSectionType
  title: string
  items: ResumeItem[]
  order: number
  status: ResumeSectionStatus
}

export type ResumeModule = {
  moduleId: string
  documentId: string
  moduleType: ResumeModuleType
  title: string
  sourceText: string
  currentText: string
  items: ResumeItem[]
  sectionId: string
  order: number
  status: ResumeModuleStatus
  parseConfidence: number
}

export type DraftDocument = {
  documentId: string
  sessionId: string
  sourceResumeId?: string
  language: Locale
  templateId: string
  modules?: ResumeModule[]
  sections: ResumeSection[]
  revision: number
  hasUnconfirmedChanges: boolean
  updatedAt: string
}

export type Suggestion = {
  suggestionId: string
  sessionId: string
  documentId: string
  analysisScope?: AnalysisScope
  targetModuleId?: string
  targetModuleType?: ResumeModuleType
  targetSectionId?: string
  targetItemId?: string
  targetText?: string
  issue: string
  recommendation: string
  exampleRewrite?: string
  suggestedOperation?: SuggestedOperation
  destinationModuleType?: ResumeModuleType
  riskLevel: RiskLevel
  needsUserConfirmation: boolean
  needsUserInput?: boolean
  questions?: string[]
  source?: SuggestionSource
  extractionStatus?: SuggestionExtractionStatus
  rawReplyAvailable?: boolean
  blockedReason?: string
  status: SuggestionStatus
  createdAt: string
}

export type InsertProposal = {
  proposalId: string
  newExperienceId: string
  operationId: string
  targetSectionId: string
  targetSectionType: ResumeSectionType
  insertPosition: InsertPosition
  insertedText: string
  updatedDraftDocument: DraftDocument
  placementReason: string
  needsUserConfirmation: boolean
  missingFields?: string[]
  riskNotes: string[]
  status: InsertProposalStatus
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
  draftDocument: DraftDocument
  sections: ResumeSection[]
  modules?: ResumeModule[]
  warnings: string[]
  parseStatus?: string
  fallbackAction?: string
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

export type AnalyzeResumeResponse = {
  sessionId: string
  documentId: string
  suggestions: Suggestion[]
  analysisScope?: AnalysisScope
  targetModuleId?: string
  promptVersion: string
  modelProvider: string
  modelName: string
}

export type AnalyzeResumeRequest = {
  sessionId: string
  aiKeyMode?: AiKeyMode
  analysisScope?: AnalysisScope
  targetModuleId?: string
  providerInteractionMode?: ProviderInteractionMode
  moduleContext?: ResumeModule
  draftDocument: DraftDocument
  analysisGoal?: string
}

export type AnalyzeStreamStage = 'validating' | 'calling_ai' | 'finalizing' | 'done' | 'error' | string

export type AnalyzeStreamEvent = {
  stage: AnalyzeStreamStage
  message: string
  data?: unknown
}

export type NewWorkExperience = {
  companyName: string
  positionTitle: string
  employmentStart: string
  employmentEnd: string
  isCurrentRole: boolean
  projectName: string
  projectDescription: string
  responsibilities: string
  actions: string
  outcomes: string
  rawText: string
}

export type AiProviderConfigInput = {
  provider?: string
  baseUrl: string
  model?: string
  wireApi?: AiWireApi
  responseFormat?: AiResponseFormat
  apiKey: string
  reasoningEffort?: string
  disableResponseStorage?: boolean
  requestTimeoutMs?: number
  maxOutputTokens?: number
  rememberInBrowser?: boolean
}

export type AiProviderConfigResponse = {
  provider: string
  baseUrl: string
  model: string
  wireApi?: AiWireApi | string
  responseFormat?: AiResponseFormat | string
  apiKeyMask: string
  keyStatus: 'configured' | string
  capabilityStatus?: AiCapabilityStatus | string
  capabilityCheckedAt?: string | null
  createdAt: string
  expiresAt: string
  rememberInBrowser: boolean
}

export type ClearAiProviderResponse = {
  keyStatus: 'cleared' | string
}

export type AiProviderCapabilities = {
  textGeneration: boolean
  jsonOutput: boolean
  resumeSuggestion: boolean
  zhResumeUnderstanding: boolean
  contextLengthEnough: boolean
}

export type AiProviderCapabilityResponse = {
  sessionId: string
  aiKeyMode: AiKeyMode
  provider: string
  model: string
  wireApi: AiWireApi | string
  responseFormat: AiResponseFormat | string
  capabilityStatus: AiCapabilityStatus | string
  capabilities: AiProviderCapabilities
  warnings: string[]
  blockedReason?: string | null
  checkedAt: string
}

export type InsertExperienceResponse = {
  proposal: InsertProposal
}

export type ExportResponse = {
  export: ExportRecord
  fileName: string
  contentType: string
  content?: string
  contentBase64?: string
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('content-type', 'application/json')
  if (runtimeAccessToken && path !== '/health') {
    headers.set('authorization', `Bearer ${runtimeAccessToken}`)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
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

async function streamRequest(
  path: string,
  body: unknown,
  onEvent: (event: AnalyzeStreamEvent, eventName: string) => void,
): Promise<AnalyzeResumeResponse> {
  const headers = new Headers()
  headers.set('content-type', 'application/json')
  headers.set('accept', 'text/event-stream')
  if (runtimeAccessToken) {
    headers.set('authorization', `Bearer ${runtimeAccessToken}`)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text()
    const payload = text ? JSON.parse(text) : null
    throw new ApiClientError(
      response.status,
      payload?.code ?? 'request_error',
      payload?.error ?? '请求失败',
      payload?.details ?? '后端暂时不可用，请稍后重试。',
      payload?.recoverable ?? true,
    )
  }

  if (!response.body) {
    throw new ApiClientError(0, 'stream_unavailable', '分析进度不可用', '后端没有返回可读取的进度流，请稍后重试。', true)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finalResponse: AnalyzeResumeResponse | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const chunks = buffer.split(/\n\n/)
    buffer = chunks.pop() ?? ''
    for (const chunk of chunks) {
      const parsed = parseSseChunk(chunk)
      if (!parsed) continue
      onEvent(parsed.payload, parsed.eventName)
      if (parsed.eventName === 'done') {
        finalResponse = parsed.payload.data as AnalyzeResumeResponse
      }
      if (parsed.eventName === 'error') {
        const payload = parsed.payload.data as Partial<ApiClientError> & { code?: string; error?: string; details?: string; recoverable?: boolean }
        throw new ApiClientError(
          200,
          payload?.code ?? 'stream_error',
          payload?.error ?? parsed.payload.message ?? 'AI 分析失败',
          payload?.details ?? parsed.payload.message ?? 'AI 分析暂时失败，请稍后重试。',
          payload?.recoverable ?? true,
        )
      }
    }
  }

  if (!finalResponse) {
    throw new ApiClientError(0, 'stream_incomplete', 'AI 分析未完成', '分析进度流提前结束，请稍后重试；你的编辑内容已保留。', true)
  }

  return finalResponse
}

function parseSseChunk(chunk: string) {
  const lines = chunk.split(/\n/)
  const eventName = lines.find((line) => line.startsWith('event:'))?.replace(/^event:\s*/, '').trim() || 'message'
  const data = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.replace(/^data:\s*/, ''))
    .join('\n')
  if (!data) return null
  return {
    eventName,
    payload: JSON.parse(data) as AnalyzeStreamEvent,
  }
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
  analyzeResume: (body: AnalyzeResumeRequest) =>
    request<AnalyzeResumeResponse>('/api/resumes/analyze', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  analyzeResumeStream: (body: AnalyzeResumeRequest, onEvent: (event: AnalyzeStreamEvent, eventName: string) => void) =>
    streamRequest('/api/resumes/analyze/stream', body, onEvent),
  insertExperience: (body: {
    sessionId: string
    aiKeyMode?: AiKeyMode
    draftDocument: DraftDocument
    newExperience: string
    newWorkExperience?: NewWorkExperience
  }) =>
    request<InsertExperienceResponse>('/api/resumes/insert-experience', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  configureAiProvider: (sessionId: string, body: AiProviderConfigInput) =>
    request<AiProviderConfigResponse>(`/api/sessions/${sessionId}/ai-provider`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  checkAiProviderCapability: (sessionId: string, body: {
    aiKeyMode?: AiKeyMode
    sampleLanguage?: Locale
  }) =>
    request<AiProviderCapabilityResponse>(`/api/sessions/${sessionId}/ai-provider/check`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  clearAiProvider: (sessionId: string) =>
    request<ClearAiProviderResponse>(`/api/sessions/${sessionId}/ai-provider`, {
      method: 'DELETE',
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
  exportResume: (body: {
    sessionId: string
    draftDocument: DraftDocument
    format: ExportFormat
  }) =>
    request<ExportResponse>('/api/exports', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
}
