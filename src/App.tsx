import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ApiClientError,
  api,
  hasAccessToken,
  setAccessToken,
  type AiCapabilityStatus,
  type AiKeyMode,
  type AiProviderCapabilityResponse,
  type AiProviderConfigResponse,
  type AiResponseFormat,
  type AiWireApi,
  type DraftDocument,
  type ExportFormat,
  type ExportResponse,
  type HealthResponse,
  type InsertProposal,
  type NewWorkExperience,
  type ResumeItem,
  type ResumeModule,
  type ResumeModuleStatus,
  type ResumeModuleType,
  type ResumeSection,
  type ResumeSectionStatus,
  type RiskLevel,
  type SuggestedOperation,
  type Suggestion,
} from './api'
import './App.css'
import { localizeBackendText, localizeBackendTexts } from './localization'

type WorkflowStatus =
  | 'idle'
  | 'uploading'
  | 'parsing'
  | 'parse_failed'
  | 'editing'
  | 'module_ready'
  | 'module_analyzing'
  | 'suggestion_extracting'
  | 'suggestion_extract_failed'
  | 'model_checking'
  | 'model_unsupported'
  | 'analyzing'
  | 'inserting'
  | 'ready_to_export'
  | 'exporting'
  | 'exported'
  | 'failed'

type AppError = {
  title: string
  details: string
}

type AnalyzeProgress = {
  stage: string
  message: string
}

type BrowserPdfExport = {
  fileName: string
  contentType: string
  createdAt: string
}

type ResumeProfile = {
  fullName: string
  phone: string
  email: string
  city: string
  targetRole: string
  photoDataUrl: string
}

type ExperienceFieldKey = keyof NewWorkExperience

type PreviewPage = {
  pageNumber: number
  sections: ResumeSection[]
}

type AiProviderForm = {
  provider: string
  baseUrl: string
  model: string
  wireApi: AiWireApi
  responseFormat: AiResponseFormat
  apiKey: string
  rememberInBrowser: boolean
}

const minimumResumeChars = 40
const AI_PROVIDER_STORAGE_KEY = 'ai-cv-user-ai-provider'

const sampleResume = [
  '张明',
  '后端工程师 | Rust / Node.js / PostgreSQL',
  '',
  '个人总结',
  '5 年后端开发经验，长期负责业务 API、数据处理和性能优化。',
  '',
  '工作经历',
  '负责 Rust 后端 API 性能优化，重构缓存和 SQL 查询，将核心接口响应时间从 900ms 降到 300ms。',
  '主导接口稳定性项目，与产品、前端、数据团队协作上线监控告警，减少线上重复问题。',
  '参与用户增长数据分析，使用 SQL 和仪表盘定位转化漏斗问题。',
  '',
  '项目经历',
  '搭建简历导出服务，支持 Markdown 和 PDF 输出。',
  '',
  '技能',
  'Rust、TypeScript、PostgreSQL、Redis、Docker、Linux',
].join('\n')

const statusLabel: Record<WorkflowStatus, string> = {
  idle: '未开始',
  uploading: '读取文件中',
  parsing: '解析中',
  parse_failed: '解析失败',
  editing: '编辑中',
  module_ready: '模块就绪',
  module_analyzing: '模块分析中',
  suggestion_extracting: '提取建议中',
  suggestion_extract_failed: '建议提取失败',
  model_checking: '检测模型',
  model_unsupported: '模型不支持',
  analyzing: '分析中',
  inserting: '插入中',
  ready_to_export: '可导出',
  exporting: '导出中',
  exported: '已导出',
  failed: '失败',
}

const sectionTitle: Record<string, string> = {
  basic_info: '基本信息',
  summary: '个人总结',
  education: '教育经历',
  work_experience: '工作经历',
  project_experience: '项目经历',
  skills: '技能',
  certifications: '证书',
  additional: '其他',
}

const moduleTypeLabel: Record<string, string> = {
  basic_info: '基本信息',
  summary: '个人总结',
  education: '教育经历',
  work_experience: '工作经历',
  project_experience: '项目经历',
  skills: '技能',
  certifications: '证书',
  additional: '其他',
  unknown: '未识别模块',
}

const moduleStatusLabel: Record<string, string> = {
  normal: '待分析',
  needs_review: '需确认',
  analyzing: '分析中',
  has_suggestions: '有建议',
  applied: '已应用',
  ignored: '已忽略',
  unknown: '待确认',
}

const operationLabel: Record<SuggestedOperation, string> = {
  rewrite_in_place: '模块内改写',
  split_into_bullets: '拆成要点',
  move_to_module: '建议移动',
  split_module: '拆分模块',
  merge_with_module: '合并模块',
  delete_from_module: '删除内容',
}

const riskLabel: Record<RiskLevel, string> = {
  low: '低风险',
  medium: '需确认',
  high: '高风险',
}

const emptyResumeProfile: ResumeProfile = {
  fullName: '',
  phone: '',
  email: '',
  city: '',
  targetRole: '',
  photoDataUrl: '',
}

const emptyWorkExperience: NewWorkExperience = {
  companyName: '',
  positionTitle: '',
  employmentStart: '',
  employmentEnd: '',
  isCurrentRole: false,
  projectName: '',
  projectDescription: '',
  responsibilities: '',
  actions: '',
  outcomes: '',
  rawText: '',
}

const defaultAiProviderForm: AiProviderForm = {
  provider: 'openai_compatible',
  baseUrl: '',
  model: 'gpt-5.5',
  wireApi: 'responses',
  responseFormat: 'auto',
  apiKey: '',
  rememberInBrowser: false,
}

const experienceFieldLabel: Record<ExperienceFieldKey, string> = {
  companyName: '公司名',
  positionTitle: '职位',
  employmentStart: '入职开始时间',
  employmentEnd: '离职结束时间',
  isCurrentRole: '至今',
  projectName: '主要项目名称',
  projectDescription: '项目介绍',
  responsibilities: '主要职责',
  actions: '关键动作',
  outcomes: '结果或产出',
  rawText: '自由描述',
}

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [status, setStatus] = useState<WorkflowStatus>('idle')
  const [error, setError] = useState<AppError | null>(null)
  const [accessTokenInput, setAccessTokenInput] = useState('')
  const [needsAccessToken, setNeedsAccessToken] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [resumeText, setResumeText] = useState('')
  const [draftDocument, setDraftDocument] = useState<DraftDocument | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [analyzeProgress, setAnalyzeProgress] = useState<AnalyzeProgress | null>(null)
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false)
  const [aiProviderForm, setAiProviderForm] = useState<AiProviderForm>(() => loadStoredAiProviderForm())
  const [aiProviderConfig, setAiProviderConfig] = useState<AiProviderConfigResponse | null>(null)
  const [aiCapability, setAiCapability] = useState<AiProviderCapabilityResponse | null>(null)
  const [resumeProfile, setResumeProfile] = useState<ResumeProfile>(emptyResumeProfile)
  const [newWorkExperience, setNewWorkExperience] = useState<NewWorkExperience>(emptyWorkExperience)
  const [insertProposal, setInsertProposal] = useState<InsertProposal | null>(null)
  const [exportState, setExportState] = useState<ExportResponse | null>(null)
  const [browserPdfExport, setBrowserPdfExport] = useState<BrowserPdfExport | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [draftHistory, setDraftHistory] = useState<DraftDocument[]>([])
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null)
  const [analyzingModuleId, setAnalyzingModuleId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    api
      .health()
      .then((response) => {
        setHealth(response)
        if (response.accessControlRequired && !hasAccessToken()) {
          setNeedsAccessToken(true)
        }
      })
      .catch(() => {
        setHealth(null)
      })
  }, [])

  const draftStats = useMemo(() => getDraftStats(draftDocument), [draftDocument])
  const resumeModules = useMemo(() => getResumeModules(draftDocument), [draftDocument])
  const selectedModule = selectedModuleId ? resumeModules.find((module) => module.moduleId === selectedModuleId) ?? null : null
  const activeSuggestions = suggestions.filter((suggestion) => suggestion.status === 'open' || suggestion.status === 'blocked')
  const moduleSuggestionCounts = useMemo(
    () => getModuleSuggestionCounts(resumeModules, activeSuggestions),
    [resumeModules, activeSuggestions],
  )
  const appliedSuggestions = suggestions.filter((suggestion) => suggestion.status === 'applied')
  const canUseBackend = health?.ok === true
  const hasUserAiKey = aiProviderConfig?.keyStatus === 'configured'
  const aiAnalysisUnavailable = canUseBackend && isAiAnalysisUnavailable(health, hasUserAiKey)
  const aiKeyMode = resolveAiKeyMode(health, hasUserAiKey)
  const modelCapability = getModelCapability(aiProviderConfig, aiCapability, hasUserAiKey)
  const modelCapabilityBlocker = getModelCapabilityBlocker(modelCapability, hasUserAiKey)
  const shouldRequireManualSuggestionApply = modelCapability === 'basic'

  function saveAccessToken() {
    setAccessToken(accessTokenInput)
    setNeedsAccessToken(!accessTokenInput.trim())
    setError(null)
  }

  async function ensureSession(): Promise<string> {
    if (sessionId) return sessionId
    const response = await api.createSession({ locale: 'zh', targetLanguage: 'zh' })
    setSessionId(response.session.sessionId)
    return response.session.sessionId
  }

  async function saveAiProviderConfig() {
    const validation = validateAiProviderForm(aiProviderForm)
    if (!validation.valid) {
      setError({ title: '模型 key 配置不完整', details: `请补充：${validation.missing.join('、')}。` })
      setAiSettingsOpen(true)
      return
    }

    setError(null)
    try {
      const activeSessionId = await ensureSession()
      const response = await api.configureAiProvider(activeSessionId, {
        provider: aiProviderForm.provider.trim() || undefined,
        baseUrl: aiProviderForm.baseUrl.trim(),
        model: aiProviderForm.model.trim() || undefined,
        wireApi: aiProviderForm.wireApi,
        responseFormat: aiProviderForm.responseFormat,
        apiKey: aiProviderForm.apiKey.trim(),
        rememberInBrowser: aiProviderForm.rememberInBrowser,
        disableResponseStorage: true,
      })
      setAiProviderConfig(response)
      setAiCapability(null)
      if (aiProviderForm.rememberInBrowser) {
        saveStoredAiProviderForm(aiProviderForm)
      } else {
        clearStoredAiProviderForm()
        setAiProviderForm((current) => ({ ...current, apiKey: '', rememberInBrowser: false }))
      }
      setError(null)
      await checkAiProviderCapability(activeSessionId, response)
    } catch (caught) {
      if (isUnauthorizedError(caught)) setNeedsAccessToken(true)
      setError(normalizeError(caught, '模型 key 保存失败'))
      setAiSettingsOpen(true)
    }
  }

  async function checkAiProviderCapability(activeSessionId = sessionId, config = aiProviderConfig) {
    if (!activeSessionId || !config) {
      setError({ title: '还没有可检测的模型 key', details: '请先保存本次会话的模型 key，再检测模型能力。' })
      setAiSettingsOpen(true)
      return null
    }

    setError(null)
    setStatus('model_checking')
    try {
      const response = await api.checkAiProviderCapability(activeSessionId, {
        aiKeyMode: 'user_session_key',
        sampleLanguage: 'zh',
      })
      setAiCapability(response)
      setAiProviderConfig({
        ...config,
        capabilityStatus: response.capabilityStatus,
        capabilityCheckedAt: response.checkedAt,
        wireApi: response.wireApi,
        responseFormat: response.responseFormat,
      })
      if (response.capabilityStatus === 'unsupported') {
        setStatus('model_unsupported')
        setError({
          title: '当前模型不支持简历分析',
          details: localizeBackendText(response.blockedReason) || '当前模型无法返回结构化建议，请更换支持文本生成和 JSON 输出的模型，或改用默认模型。',
        })
        setAiSettingsOpen(true)
        return response
      }
      setStatus(draftDocument ? 'editing' : 'idle')
      setAiSettingsOpen(false)
      return response
    } catch (caught) {
      if (isUnauthorizedError(caught)) setNeedsAccessToken(true)
      setStatus(draftDocument ? 'editing' : 'failed')
      setError(normalizeError(caught, '模型能力检测失败'))
      setAiSettingsOpen(true)
      return null
    }
  }

  async function clearAiProviderConfig() {
    setError(null)
    clearStoredAiProviderForm()
    setAiProviderForm(defaultAiProviderForm)
    if (!sessionId) {
      setAiProviderConfig(null)
      setAiCapability(null)
      return
    }
    try {
      await api.clearAiProvider(sessionId)
      setAiProviderConfig(null)
      setAiCapability(null)
    } catch (caught) {
      if (isUnauthorizedError(caught)) setNeedsAccessToken(true)
      setError(normalizeError(caught, '模型 key 清除失败'))
    }
  }

  function updateAiProviderForm(field: keyof AiProviderForm, value: string | boolean) {
    setAiProviderForm((current) => ({ ...current, [field]: value }))
    if (field === 'provider' || field === 'baseUrl' || field === 'model' || field === 'wireApi' || field === 'responseFormat' || field === 'apiKey') {
      setAiCapability(null)
      setAiProviderConfig((current) => current ? { ...current, capabilityStatus: 'unknown', capabilityCheckedAt: null } : current)
    }
  }

  function replaceDraftDocument(nextDraft: DraftDocument, keepHistory = true) {
    setDraftDocument((current) => {
      if (current && keepHistory) {
        setDraftHistory((history) => [...history.slice(-9), current])
      }
      return nextDraft
    })
    setExportState(null)
    setBrowserPdfExport(null)
  }

  async function parseDraftFromText(): Promise<DraftDocument | null> {
    const text = resumeText.trim()
    if (text.length < minimumResumeChars) {
      setError(emptyResumeError())
      setStatus('parse_failed')
      return null
    }

    setError(null)
    setStatus('parsing')
    try {
      const response = await api.parseResume({
        sessionId: sessionId ?? undefined,
        locale: 'zh',
        targetLanguage: 'zh',
        resumeText: text,
        fileName: supportedBackendFileName(fileName),
        mimeType: supportedBackendMimeType(fileName),
      })
      setSessionId(response.session.sessionId)
      setDraftHistory([])
      const parsedDraft = {
        ...response.draftDocument,
        modules: response.draftDocument.modules?.length ? response.draftDocument.modules : response.modules,
      }
      replaceDraftDocument(parsedDraft, false)
      setSelectedModuleId(getResumeModules(parsedDraft)[0]?.moduleId ?? null)
      setResumeProfile((current) => mergeProfileFromDraft(current, parsedDraft, fileName, text))
      setWarnings(localizeBackendTexts([
        ...response.warnings,
        ...(response.parseStatus ? [`解析状态：${response.parseStatus}`] : []),
        ...(response.fallbackAction ? [`后续处理：${response.fallbackAction}`] : []),
      ]))
      setSuggestions([])
      setInsertProposal(null)
      setStatus(getResumeModules(parsedDraft).length > 0 ? 'module_ready' : 'editing')
      return parsedDraft
    } catch (caught) {
      if (isUnauthorizedError(caught)) setNeedsAccessToken(true)
      setStatus('parse_failed')
      setError(normalizeError(caught, '简历解析失败'))
      return null
    }
  }

  async function analyzeResume(targetModule?: ResumeModule) {
    const activeDraft = draftDocument ?? await parseDraftFromText()
    if (!activeDraft) return
    if (isAiAnalysisUnavailable(health, hasUserAiKey)) {
      setStatus('failed')
      setError(aiProviderNotConfiguredError('AI 分析暂时不可用'))
      setAiSettingsOpen(true)
      return
    }
    if (modelCapabilityBlocker) {
      setStatus(modelCapability === 'unsupported' ? 'model_unsupported' : 'failed')
      setError(modelCapabilityBlocker)
      setAiSettingsOpen(true)
      return
    }

    setError(null)
    const activeModules = getResumeModules(activeDraft)
    const requestDraft = { ...activeDraft, modules: activeModules }
    const requestModule = targetModule
      ? activeModules.find((module) => module.moduleId === targetModule.moduleId) ?? null
      : null
    if (targetModule && !requestModule) {
      setError({ title: '模块不存在', details: '当前模块不在最新草稿中，请重新选择模块后再分析。' })
      return
    }

    const isModuleAnalysis = Boolean(requestModule)
    setStatus(isModuleAnalysis ? 'module_analyzing' : 'analyzing')
    setAnalyzingModuleId(requestModule?.moduleId ?? null)
    setSelectedModuleId(requestModule?.moduleId ?? selectedModuleId)
    if (requestModule) {
      setDraftDocument((current) => current ? { ...current, modules: updateModuleStatus(getResumeModules(current), requestModule.moduleId, 'analyzing') } : current)
    }
    setAnalyzeProgress({ stage: 'starting', message: isModuleAnalysis ? `正在准备分析模块：${requestModule?.title}` : '正在准备分析请求' })
    try {
      const request = {
        sessionId: requestDraft.sessionId,
        aiKeyMode,
        analysisScope: requestModule ? 'module' as const : 'document' as const,
        targetModuleId: requestModule?.moduleId,
        providerInteractionMode: requestModule ? 'chat_messages' as const : undefined,
        moduleContext: requestModule ?? undefined,
        draftDocument: requestDraft,
        analysisGoal: requestModule ? `分析并优化模块：${requestModule.title}` : 'improve_clarity',
      }
      const response = await api.analyzeResumeStream(request, (event) => {
        setAnalyzeProgress({ stage: event.stage, message: localizeBackendText(event.message) })
      }).catch((caught) => {
        if (canFallbackToPlainAnalyze(caught)) {
          setAnalyzeProgress({ stage: 'calling_ai', message: '正在调用 AI 分析简历' })
          return api.analyzeResume(request)
        }
        throw caught
      })
      setSuggestions((current) => mergeSuggestions(current, response.suggestions, requestModule))
      if (requestModule) {
        const nextModuleStatus: ResumeModuleStatus = response.suggestions.length > 0 ? 'has_suggestions' : 'normal'
        setDraftDocument((current) => current ? { ...current, modules: updateModuleStatus(getResumeModules(current), requestModule.moduleId, nextModuleStatus) } : current)
      }
      setAnalyzeProgress({ stage: 'done', message: isModuleAnalysis ? '模块分析完成' : '简历分析完成' })
      setStatus('editing')
    } catch (caught) {
      if (isUnauthorizedError(caught)) setNeedsAccessToken(true)
      if (caught instanceof ApiClientError && caught.code === 'ai_response_unparseable') {
        setStatus('suggestion_extract_failed')
        setError(normalizeError(caught, 'AI 回复无法转换成修改建议'))
      } else {
        setStatus('failed')
        setError(normalizeError(caught, isModuleAnalysis ? '模块分析失败' : 'AI 分析失败'))
      }
      if (requestModule) {
        setDraftDocument((current) => current ? { ...current, modules: updateModuleStatus(getResumeModules(current), requestModule.moduleId, 'needs_review') } : current)
      }
      setAnalyzeProgress(null)
    } finally {
      setAnalyzingModuleId(null)
      window.setTimeout(() => {
        setAnalyzeProgress((current) => (current?.stage === 'done' ? null : current))
      }, 1200)
    }
  }

  async function insertExperience() {
    if (!draftDocument) {
      setError({ title: '还没有简历草稿', details: '请先粘贴或上传简历，解析成可编辑草稿。' })
      return
    }
    if (isAiAnalysisUnavailable(health, hasUserAiKey)) {
      setStatus('failed')
      setError(aiProviderNotConfiguredError('新增经历暂时不能自动插入'))
      setAiSettingsOpen(true)
      return
    }
    if (modelCapabilityBlocker) {
      setStatus(modelCapability === 'unsupported' ? 'model_unsupported' : 'failed')
      setError(modelCapabilityBlocker)
      setAiSettingsOpen(true)
      return
    }

    const validation = validateWorkExperience(newWorkExperience)
    if (!validation.valid) {
      setError({
        title: '新增经历缺少关键信息',
        details: `请先补充：${validation.missingLabels.join('、')}。AI 只能整理你提供过的信息，不能替你编造公司、职位、时间或结果。`,
      })
      return
    }
    const text = formatWorkExperienceForApi(newWorkExperience)

    setError(null)
    setStatus('inserting')
    try {
      const response = await api.insertExperience({
        sessionId: draftDocument.sessionId,
        aiKeyMode,
        draftDocument,
        newExperience: text,
        newWorkExperience,
      })
      setInsertProposal(response.proposal)
      setStatus('editing')
    } catch (caught) {
      if (isUnauthorizedError(caught)) setNeedsAccessToken(true)
      setStatus('failed')
      setError(normalizeError(caught, '新增经历插入失败'))
    }
  }

  function acceptInsertProposal() {
    if (!insertProposal) return
    replaceDraftDocument(insertProposal.updatedDraftDocument)
    setNewWorkExperience(emptyWorkExperience)
    setInsertProposal(null)
  }

  function rejectInsertProposal() {
    setInsertProposal(null)
  }

  function editInsertProposalText(text: string) {
    setInsertProposal((current) => {
      if (!current) return current
      return {
        ...current,
        insertedText: text,
        updatedDraftDocument: updateInsertedProposalText(current.updatedDraftDocument, current.targetSectionId, text),
      }
    })
  }

  function undoLastDraftChange() {
    setDraftHistory((history) => {
      const previousDraft = history.at(-1)
      if (!previousDraft) return history
      setDraftDocument(previousDraft)
      setExportState(null)
      setBrowserPdfExport(null)
      setInsertProposal(null)
      setSuggestions((current) => current.map((suggestion) => (
        suggestion.status === 'applied' ? { ...suggestion, status: 'open' } : suggestion
      )))
      setStatus('editing')
      return history.slice(0, -1)
    })
  }

  function updateItemText(sectionId: string, itemId: string, text: string) {
    setDraftDocument((current) => {
      if (!current) return current
      const nextSections = current.sections.map((section) => {
        if (section.sectionId !== sectionId) return section
        return {
          ...section,
          status: section.status === 'needs_review' ? 'normal' as const : section.status,
          items: section.items.map((item) => {
            if (item.itemId !== itemId) return item
            return { ...item, text, source: 'manual_edit' as const, status: 'normal' as const }
          }),
        }
      })
      return {
        ...current,
        revision: current.revision + 1,
        hasUnconfirmedChanges: hasNeedsReviewItems(nextSections),
        updatedAt: new Date().toISOString(),
        sections: nextSections,
        modules: updateModulesFromSections(current.modules, nextSections),
      }
    })
    setExportState(null)
    setBrowserPdfExport(null)
  }

  function addItem(sectionId: string) {
    setDraftDocument((current) => {
      if (!current) return current
      setDraftHistory((history) => [...history.slice(-9), current])
      const nextSections = current.sections.map((section) => {
        if (section.sectionId !== sectionId) return section
        const item: ResumeItem = {
          itemId: `local_${Date.now()}`,
          sectionId,
          itemType: itemTypeForSection(section.sectionType),
          text: '',
          fields: {},
          order: section.items.length,
          source: 'manual_edit',
          status: 'normal',
        }
        const items = [...section.items, item]
        return { ...section, status: 'normal' as const, items }
      })
      return {
        ...current,
        revision: current.revision + 1,
        hasUnconfirmedChanges: hasNeedsReviewItems(nextSections),
        updatedAt: new Date().toISOString(),
        sections: nextSections,
        modules: updateModulesFromSections(current.modules, nextSections),
      }
    })
    setExportState(null)
    setBrowserPdfExport(null)
  }

  function removeItem(sectionId: string, itemId: string) {
    setDraftDocument((current) => {
      if (!current) return current
      setDraftHistory((history) => [...history.slice(-9), current])
      const nextSections = current.sections.map((section) => {
        if (section.sectionId !== sectionId) return section
        const items = section.items.filter((item) => item.itemId !== itemId)
        const status: ResumeSectionStatus = items.some((item) => item.status === 'needs_review') ? 'needs_review' : 'normal'
        return {
          ...section,
          status,
          items,
        }
      })
      return {
        ...current,
        revision: current.revision + 1,
        hasUnconfirmedChanges: hasNeedsReviewItems(nextSections),
        updatedAt: new Date().toISOString(),
        sections: nextSections,
        modules: updateModulesFromSections(current.modules, nextSections),
      }
    })
  }

  function applySuggestion(suggestion: Suggestion) {
    if (!draftDocument) return

    const blocker = getSuggestionApplyBlocker(suggestion, shouldRequireManualSuggestionApply)
    if (blocker) {
      setError({
        title: '这条建议不能直接应用',
        details: blocker,
      })
      return
    }

    const targetSection = draftDocument.sections.find((section) => (
      section.items.some((item) => item.itemId === suggestion.targetItemId)
    ))
    if (!targetSection) {
      setError({
        title: '这条建议不能直接应用',
        details: '这条建议没有找到对应的简历条目，请先手动编辑对应内容。',
      })
      return
    }
    if (suggestion.analysisScope === 'module' && suggestion.targetModuleId) {
      const targetModule = getResumeModules(draftDocument).find((module) => module.moduleId === suggestion.targetModuleId)
      if (!targetModule || targetModule.sectionId !== targetSection.sectionId) {
        setError({
          title: '这条模块建议不能直接应用',
          details: '单模块分析建议只能修改目标模块。涉及移动、拆分或合并时，需要你手动确认后再处理。',
        })
        return
      }
    }

    const nextSections = draftDocument.sections.map((section) => ({
      ...section,
      status: section.sectionId === suggestion.targetSectionId && suggestion.needsUserConfirmation ? 'needs_review' as const : section.status,
      items: section.items.map((item) => {
        if (item.itemId !== suggestion.targetItemId) return item
        return {
          ...item,
          text: suggestion.exampleRewrite ?? item.text,
          source: 'ai_suggestion_applied' as const,
          status: suggestion.needsUserConfirmation ? 'needs_review' as const : 'normal' as const,
        }
      }),
    }))
    replaceDraftDocument({
      ...draftDocument,
      revision: draftDocument.revision + 1,
      hasUnconfirmedChanges: suggestion.needsUserConfirmation || hasNeedsReviewItems(nextSections),
      updatedAt: new Date().toISOString(),
      sections: nextSections,
      modules: updateModulesFromSections(draftDocument.modules, nextSections, suggestion.targetModuleId, 'applied'),
    })
    setSuggestions((current) => current.map((item) => (
      item.suggestionId === suggestion.suggestionId ? { ...item, status: 'applied' } : item
    )))
  }

  function ignoreSuggestion(suggestionId: string) {
    const ignoredSuggestion = suggestions.find((suggestion) => suggestion.suggestionId === suggestionId)
    setSuggestions((current) => current.map((item) => (
      item.suggestionId === suggestionId ? { ...item, status: 'ignored' } : item
    )))
    const ignoredModuleId = ignoredSuggestion?.targetModuleId
    if (ignoredModuleId) {
      setDraftDocument((current) => {
        if (!current) return current
        const stillOpenForModule = suggestions.some((suggestion) => (
          suggestion.suggestionId !== suggestionId
          && suggestion.targetModuleId === ignoredModuleId
          && (suggestion.status === 'open' || suggestion.status === 'blocked')
        ))
        return {
          ...current,
          modules: updateModuleStatus(
            getResumeModules(current),
            ignoredModuleId,
            stillOpenForModule ? 'has_suggestions' : 'ignored',
          ),
        }
      })
    }
  }

  async function copySuggestionRewrite(suggestion: Suggestion) {
    if (!suggestion.exampleRewrite?.trim()) {
      setError({ title: '没有可复制的改写文本', details: '这条建议没有返回可直接放进简历的成品句。' })
      return
    }
    await navigator.clipboard.writeText(suggestion.exampleRewrite)
  }

  function confirmReviewItems() {
    setDraftDocument((current) => {
      if (!current) return current
      setDraftHistory((history) => [...history.slice(-9), current])
      return {
        ...current,
        revision: current.revision + 1,
        hasUnconfirmedChanges: false,
        updatedAt: new Date().toISOString(),
        sections: current.sections.map((section) => ({
          ...section,
          status: section.status === 'needs_review' ? 'normal' : section.status,
          items: section.items.map((item) => ({
            ...item,
            status: item.status === 'needs_review' ? 'normal' : item.status,
          })),
        })),
        modules: markAllModulesFromSections(current.modules, current.sections),
      }
    })
    setExportState(null)
    setBrowserPdfExport(null)
  }

  function updateResumeProfile(field: keyof ResumeProfile, value: string) {
    setResumeProfile((current) => ({ ...current, [field]: value }))
    setExportState(null)
    setBrowserPdfExport(null)
  }

  async function handleProfilePhoto(file: File) {
    if (!file.type.startsWith('image/')) {
      setError({ title: '照片格式不支持', details: '请上传 JPG、PNG 或 WebP 图片。照片只用于当前浏览器预览和打印，不会作为 AI key 或后端凭据处理。' })
      return
    }
    if (file.size > 4 * 1024 * 1024) {
      setError({ title: '照片太大', details: '请上传小于 4MB 的头像或证件照，避免打印 PDF 时变慢。' })
      return
    }
    const photoDataUrl = await readFileAsDataUrl(file)
    setResumeProfile((current) => ({ ...current, photoDataUrl }))
    setExportState(null)
    setBrowserPdfExport(null)
  }

  function removeProfilePhoto() {
    setResumeProfile((current) => ({ ...current, photoDataUrl: '' }))
    setExportState(null)
    setBrowserPdfExport(null)
  }

  function updateWorkExperience(field: ExperienceFieldKey, value: string | boolean) {
    setNewWorkExperience((current) => ({
      ...current,
      [field]: value,
      ...(field === 'isCurrentRole' && value === true ? { employmentEnd: '' } : {}),
    }))
  }

  async function exportResume(format: ExportFormat) {
    if (!draftDocument) {
      setError({ title: '还没有可导出的简历', details: '请先生成可编辑草稿。' })
      return
    }
    if (draftDocument.hasUnconfirmedChanges || draftStats.reviewItems > 0) {
      setError({
        title: '导出前需要确认',
        details: draftStats.reviewItems > 0
          ? `当前还有 ${draftStats.reviewItems} 条 AI 改动或新增经历需要你确认，确认后才能导出。`
          : '当前草稿仍标记为有未确认改动，请先确认 AI 改动或手动编辑相关条目。',
      })
      return
    }

    setError(null)
    setStatus('exporting')
    if (format === 'pdf') {
      const printExport = {
        fileName: draftPdfFileName(draftDocument, resumeProfile),
        contentType: 'application/pdf; rendered-from-preview',
        createdAt: new Date().toISOString(),
      }
      setExportState(null)
      setBrowserPdfExport(printExport)
      setStatus('exported')
      window.setTimeout(() => printPreviewAsPdf(printExport.fileName), 80)
      return
    }

    try {
      const response = await api.exportResume({
        sessionId: draftDocument.sessionId,
        draftDocument,
        format,
      })
      setExportState(response)
      setBrowserPdfExport(null)
      setStatus('exported')
    } catch (caught) {
      if (isUnauthorizedError(caught)) setNeedsAccessToken(true)
      setStatus('failed')
      setError(normalizeError(caught, '导出失败'))
    }
  }

  async function copyExport() {
    if (!exportState?.content) return
    await navigator.clipboard.writeText(exportState.content)
  }

  function downloadExport(state = exportState) {
    if (!state?.fileName) return

    if (state.contentBase64) {
      const binary = window.atob(state.contentBase64)
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
      downloadBlob(new Blob([bytes], { type: state.contentType }), state.fileName)
      return
    }

    if (state.content) {
      downloadBlob(new Blob([state.content], { type: state.contentType }), state.fileName)
    }
  }

  async function handleFile(file: File) {
    setFileName(file.name)
    setError(null)
    setStatus('uploading')
    resetDraftState()

    const extension = fileExtension(file.name)
    if (extension !== 'txt' && extension !== 'md' && extension !== 'pdf' && extension !== 'docx') {
      setError({
        title: '这个格式不能直接解析',
        details: '当前支持 TXT、Markdown、PDF 和 DOCX。其他格式请复制简历正文后粘贴，避免把二进制内容误当作简历文本。',
      })
      setStatus('idle')
      return
    }

    try {
      const text = await extractResumeText(file, extension)
      setResumeText(text)
      if (text.trim().length < minimumResumeChars) {
        setError({
          title: '文件里没有读出足够的简历正文',
          details: uploadExtractionFallbackDetails(extension),
        })
        setStatus('parse_failed')
      } else {
        setError(null)
        setStatus('idle')
      }
    } catch (caught) {
      setError({
        title: '文件读取失败',
        details: caught instanceof Error ? localizeBackendText(caught.message) : '浏览器无法读取这个文件，请复制简历正文后粘贴。',
      })
      setStatus('parse_failed')
    }
  }

  function resetDraftState() {
    setResumeText('')
    setDraftDocument(null)
    setDraftHistory([])
    setSuggestions([])
    setInsertProposal(null)
    setExportState(null)
    setBrowserPdfExport(null)
    setResumeProfile(emptyResumeProfile)
    setSelectedModuleId(null)
    setAnalyzingModuleId(null)
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <PineappleLogo />
          <div>
            <strong>AI CV Studio</strong>
            <span>AI resume editor</span>
          </div>
        </div>

        <div className="topbar-center" aria-label="当前状态">
          <span className={canUseBackend ? 'status-dot online' : 'status-dot'}></span>
          <span>{canUseBackend ? `后端在线 v${health.version}` : '连接后端中'}</span>
          <span className="divider"></span>
          <span>{statusLabel[status]}</span>
        </div>

        <div className="topbar-actions">
          <input
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void handleFile(file)
              event.currentTarget.value = ''
            }}
            ref={fileInputRef}
            type="file"
          />
          <button className="button secondary" onClick={() => fileInputRef.current?.click()} type="button">
            上传
          </button>
          <button className="button secondary" onClick={() => setAiSettingsOpen((current) => !current)} type="button">
            模型设置
          </button>
          <button
            className="button primary"
            disabled={!canUseBackend || status === 'analyzing' || status === 'module_analyzing' || status === 'model_checking'}
            onClick={() => void analyzeResume()}
            type="button"
          >
            {draftDocument ? '分析建议' : '解析并分析'}
          </button>
          <button className="button secondary" disabled={!draftDocument} onClick={() => void exportResume('pdf')} type="button">
            保存 PDF
          </button>
        </div>
      </header>

      {!canUseBackend && (
        <section className="notice compact">
          <strong>后端未连接</strong>
          <p>当前可以查看和编辑界面；解析、AI 建议、插入经历和导出需要启动后端服务。</p>
        </section>
      )}

      {aiAnalysisUnavailable && (
        <section className="notice compact ai-provider-notice">
          <strong>真实 AI 分析不可用</strong>
          <p>{health?.aiAnalysisRequired ? '后端验收模式要求真实 AI provider，但当前不可用。' : '后端当前没有默认模型 key。'}你可以打开模型设置填写自己的 key；前端不会用本地规则冒充 AI 建议。</p>
        </section>
      )}

      {(aiSettingsOpen || aiAnalysisUnavailable || aiProviderConfig) && (
        <AiProviderPanel
          config={aiProviderConfig}
          capability={aiCapability}
          form={aiProviderForm}
          hasDefaultProvider={health?.aiProviderConfigured === true}
          isOpen={aiSettingsOpen || aiAnalysisUnavailable}
          isChecking={status === 'model_checking'}
          onClear={() => void clearAiProviderConfig()}
          onCheck={() => void checkAiProviderCapability()}
          onSave={() => void saveAiProviderConfig()}
          onToggle={() => setAiSettingsOpen((current) => !current)}
          onUpdate={updateAiProviderForm}
        />
      )}

      {hasUserAiKey && modelCapability && modelCapability !== 'full' && (
        <section className={modelCapability === 'basic' ? 'notice compact capability-notice basic' : 'notice compact capability-notice blocked'}>
          <strong>{capabilityStatusLabel(modelCapability)}</strong>
          <p>{capabilityStatusDescription(modelCapability, aiCapability?.blockedReason)}</p>
        </section>
      )}

      {needsAccessToken && (
        <section className="notice access-notice">
          <div>
            <strong>需要访问口令</strong>
            <p>后端已开启访问控制。输入朋友试用口令后，解析、分析、插入和导出接口会自动携带授权信息。</p>
          </div>
          <div className="access-form">
            <input
              aria-label="访问口令"
              autoComplete="off"
              placeholder="输入访问口令"
              type="password"
              value={accessTokenInput}
              onChange={(event) => setAccessTokenInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') saveAccessToken()
              }}
            />
            <button className="button primary" disabled={!accessTokenInput.trim()} onClick={saveAccessToken} type="button">
              保存口令
            </button>
          </div>
        </section>
      )}

      {error && (
        <section className="notice error" role="alert">
          <strong>{error.title}</strong>
          <p>{error.details}</p>
        </section>
      )}

      {analyzeProgress && (
        <section className="notice compact analyze-progress" aria-live="polite">
          <strong>{analysisStageLabel(analyzeProgress.stage)}</strong>
          <p>{analyzeProgress.message}</p>
        </section>
      )}

      <section className="workspace">
        <section className="main-pane">
          <WorkflowStrip draftDocument={draftDocument} suggestions={suggestions} isExported={Boolean(exportState || browserPdfExport)} />

          <div className="resume-workspace">
            <section className="panel editor-panel">
              <PanelHeader
                eyebrow="Resume source"
                title={draftDocument ? '可编辑简历' : '导入简历'}
                meta={draftDocument ? `Revision ${draftDocument.revision}` : `${resumeText.length} chars`}
              />
              {draftDocument ? (
                <>
                  <ProfileEditor
                    profile={resumeProfile}
                    onPhotoChange={(file) => void handleProfilePhoto(file)}
                    onPhotoRemove={removeProfilePhoto}
                    onUpdate={updateResumeProfile}
                  />
                  <DraftEditor
                    analyzingModuleId={analyzingModuleId}
                    draftDocument={draftDocument}
                    moduleSuggestionCounts={moduleSuggestionCounts}
                    modules={resumeModules}
                    onAddItem={addItem}
                    onAnalyzeModule={(module) => void analyzeResume(module)}
                    onRemoveItem={removeItem}
                    onSelectModule={setSelectedModuleId}
                    onUpdateItem={updateItemText}
                    onUndo={undoLastDraftChange}
                    canUndo={draftHistory.length > 0}
                    selectedModuleId={selectedModule?.moduleId ?? null}
                  />
                </>
              ) : (
                <ImportPanel
                  fileName={fileName}
                  onAnalyze={() => void analyzeResume()}
                  onSample={() => setResumeText(sampleResume)}
                  onTextChange={setResumeText}
                  resumeText={resumeText}
                />
              )}
            </section>

            <section className="panel preview-panel">
              <PanelHeader
                eyebrow="PDF preview"
                title="成品预览"
                meta={draftDocument ? 'Print source' : 'Empty'}
              />
              <ResumePreview draftDocument={draftDocument} profile={resumeProfile} />
            </section>
          </div>

          <section className="panel add-panel">
            <PanelHeader eyebrow="Add experience" title="新增工作经历" meta="Structured input" />
            <WorkExperienceForm
              disabled={status === 'inserting' || Boolean(modelCapabilityBlocker)}
              value={newWorkExperience}
              onSubmit={insertExperience}
              onUpdate={updateWorkExperience}
            />
          </section>
        </section>

        <aside className="assistant-panel" aria-label="AI 优化建议">
          <section className="panel insight-panel">
            <PanelHeader eyebrow="AI suggestions" title="优化建议" meta={`${activeSuggestions.length} open`} />
            <SuggestionList
              manualApplyRequired={shouldRequireManualSuggestionApply}
              modules={resumeModules}
              onApply={applySuggestion}
              onCopy={copySuggestionRewrite}
              onIgnore={ignoreSuggestion}
              suggestions={activeSuggestions}
            />
          </section>

          {insertProposal && (
            <section className="panel proposal-panel">
              <PanelHeader eyebrow="Insert proposal" title="插入建议" meta={insertProposal.targetSectionType} />
              <textarea
                aria-label="编辑插入建议文本"
                className="proposal-textarea"
                value={insertProposal.insertedText}
                onChange={(event) => editInsertProposalText(event.target.value)}
              />
              <p className="muted">{localizeBackendText(insertProposal.placementReason)}</p>
              {insertProposal.riskNotes.length > 0 && (
                <ul className="risk-list">
                  {insertProposal.riskNotes.map((note) => <li key={note}>{localizeBackendText(note)}</li>)}
                </ul>
              )}
              {insertProposal.missingFields && insertProposal.missingFields.length > 0 && (
                <div className="missing-field-box">
                  <strong>后端标记缺少字段</strong>
                  <p>{insertProposal.missingFields.map((field) => workExperienceFieldName(field)).join('、')}</p>
                </div>
              )}
              <div className="button-row">
                <button className="button primary" onClick={acceptInsertProposal} type="button">接受插入</button>
                <button className="button secondary" onClick={rejectInsertProposal} type="button">放弃</button>
              </div>
            </section>
          )}

          <section className="panel check-panel">
            <PanelHeader eyebrow="Export check" title="导出检查" meta={draftDocument ? 'Ready' : 'No draft'} />
            <div className="stat-grid">
              <Stat label="章节" value={draftStats.sections} />
              <Stat label="条目" value={draftStats.items} />
              <Stat label="需确认" value={draftStats.reviewItems} tone={draftStats.reviewItems ? 'warn' : 'normal'} />
              <Stat label="已应用" value={appliedSuggestions.length} />
            </div>
            {warnings.length > 0 && (
              <div className="warning-box">
                {warnings.map((warning) => <p key={warning}>{warning}</p>)}
              </div>
            )}
            {(draftDocument?.hasUnconfirmedChanges || draftStats.reviewItems > 0) && (
              <button className="button secondary full" onClick={confirmReviewItems} type="button">
                确认 AI 改动
              </button>
            )}
            <div className="export-actions">
              <button className="button secondary" disabled={!draftDocument} onClick={() => void exportResume('markdown')} type="button">
                Markdown
              </button>
              <button className="button secondary" disabled={!draftDocument} onClick={() => void exportResume('plain_text')} type="button">
                纯文本
              </button>
              <button className="button primary" disabled={!draftDocument} onClick={() => void exportResume('pdf')} type="button">
                保存 PDF
              </button>
            </div>
            {browserPdfExport && (
              <div className="export-result">
                <strong>{browserPdfExport.fileName}</strong>
                <span>{browserPdfExport.contentType}</span>
                <p>PDF 使用当前成品预览模板。请在系统打印窗口选择“保存为 PDF”。</p>
                <div className="button-row">
                  <button className="button secondary" onClick={() => printPreviewAsPdf(browserPdfExport.fileName)} type="button">
                    再次打开保存窗口
                  </button>
                </div>
              </div>
            )}
            {exportState && (
              <div className="export-result">
                <strong>{exportState.fileName}</strong>
                <span>{exportState.contentType}</span>
                <div className="button-row">
                  {exportState.content && <button className="button secondary" onClick={copyExport} type="button">复制</button>}
                  <button className="button secondary" onClick={() => downloadExport()} type="button">下载</button>
                </div>
              </div>
            )}
          </section>
        </aside>
      </section>
    </main>
  )
}

function ImportPanel({
  fileName,
  onAnalyze,
  onSample,
  onTextChange,
  resumeText,
}: {
  fileName: string | null
  onAnalyze: () => void
  onSample: () => void
  onTextChange: (value: string) => void
  resumeText: string
}) {
  return (
    <div className="import-panel">
      <div className="import-heading">
        <h1>
          <span className="desktop-title">上传或粘贴简历，让 AI 帮你找出可改进的地方。</span>
          <span className="mobile-title">粘贴简历，查看 AI 修改建议。</span>
        </h1>
        <p>先生成可编辑草稿，再在右侧查看建议，最后导出和预览一致的 PDF。</p>
      </div>
      <textarea
        className="source-textarea"
        placeholder="粘贴你的简历正文。建议包含个人总结、工作经历、项目经历、技能和教育经历。"
        value={resumeText}
        onChange={(event) => onTextChange(event.target.value)}
      />
      <div className="import-footer">
        <span>{importFooterText(fileName)}</span>
        <div className="button-row">
          <button className="button secondary" onClick={onSample} type="button">使用示例</button>
          <button className="button primary" onClick={onAnalyze} type="button">解析并分析</button>
        </div>
      </div>
    </div>
  )
}

function AiProviderPanel({
  capability,
  config,
  form,
  hasDefaultProvider,
  isChecking,
  isOpen,
  onClear,
  onCheck,
  onSave,
  onToggle,
  onUpdate,
}: {
  capability: AiProviderCapabilityResponse | null
  config: AiProviderConfigResponse | null
  form: AiProviderForm
  hasDefaultProvider: boolean
  isChecking: boolean
  isOpen: boolean
  onClear: () => void
  onCheck: () => void
  onSave: () => void
  onToggle: () => void
  onUpdate: (field: keyof AiProviderForm, value: string | boolean) => void
}) {
  const capabilityStatus = getModelCapability(config, capability, Boolean(config))

  return (
    <section className={isOpen ? 'notice ai-settings-panel open' : 'notice ai-settings-panel'}>
      <div className="ai-settings-head">
        <div>
          <strong>{config ? `已配置：${config.apiKeyMask}` : hasDefaultProvider ? '使用默认模型' : '需要模型 key'}</strong>
          <p>key 仅用于本次 AI 分析和简历编辑请求，不会写入导出文件。{config?.wireApi ? `当前协议：${wireApiLabel(config.wireApi)}` : ''}</p>
        </div>
        <button className="button secondary small" onClick={onToggle} type="button">
          {isOpen ? '收起' : '模型设置'}
        </button>
      </div>

      {config && (
        <div className={`capability-card ${capabilityStatus}`}>
          <div>
            <strong>{capabilityStatusLabel(capabilityStatus)}</strong>
            <p>{capabilityStatusDescription(capabilityStatus, capability?.blockedReason)}</p>
          </div>
          <span>{capability?.checkedAt ?? config.capabilityCheckedAt ?? '未检测'}</span>
        </div>
      )}

      {isOpen && (
        <div className="ai-settings-body">
          <div className="ai-settings-grid">
            <label>
              <span>provider</span>
              <input value={form.provider} onChange={(event) => onUpdate('provider', event.target.value)} placeholder="openai_compatible" />
            </label>
            <label>
              <span>base URL</span>
              <input value={form.baseUrl} onChange={(event) => onUpdate('baseUrl', event.target.value)} placeholder="https://api.example.com/v1" />
            </label>
            <label>
              <span>model</span>
              <input value={form.model} onChange={(event) => onUpdate('model', event.target.value)} placeholder="gpt-5.5" />
            </label>
            <label htmlFor="ai-provider-wire-api">
              <span>wire API</span>
              <select
                aria-label="wire API"
                id="ai-provider-wire-api"
                value={form.wireApi}
                onChange={(event) => onUpdate('wireApi', event.target.value)}
              >
                <option value="responses">Responses</option>
                <option value="chat_completions">Chat Completions</option>
              </select>
            </label>
            <label htmlFor="ai-provider-response-format">
              <span>response format</span>
              <select
                aria-label="response format"
                id="ai-provider-response-format"
                value={form.responseFormat}
                onChange={(event) => onUpdate('responseFormat', event.target.value)}
              >
                <option value="auto">Auto</option>
                <option value="json_schema">JSON Schema</option>
                <option value="json_object">JSON Object</option>
                <option value="plain_json">Plain JSON</option>
              </select>
            </label>
            <label>
              <span>API key</span>
              <input autoComplete="off" value={form.apiKey} onChange={(event) => onUpdate('apiKey', event.target.value)} placeholder="sk-..." type="password" />
            </label>
          </div>
          <label className="remember-key-control">
            <input checked={form.rememberInBrowser} type="checkbox" onChange={(event) => onUpdate('rememberInBrowser', event.target.checked)} />
            <span>记住 key，仅保存在当前浏览器本地。默认关闭，公共电脑不要勾选。</span>
          </label>
          <div className="ai-settings-actions">
            <button className="button primary" disabled={!form.baseUrl.trim() || !form.apiKey.trim()} onClick={onSave} type="button">
              {isChecking ? '检测中' : '保存并检测'}
            </button>
            <button className="button secondary" disabled={!config || isChecking} onClick={onCheck} type="button">
              检测模型能力
            </button>
            <button className="button secondary" disabled={!config && !form.apiKey.trim()} onClick={onClear} type="button">
              清除当前 key
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function ProfileEditor({
  onPhotoChange,
  onPhotoRemove,
  onUpdate,
  profile,
}: {
  onPhotoChange: (file: File) => void
  onPhotoRemove: () => void
  onUpdate: (field: keyof ResumeProfile, value: string) => void
  profile: ResumeProfile
}) {
  const photoInputId = 'profile-photo-input'

  return (
    <section className="profile-editor" aria-label="照片与基本信息">
      <div className="profile-photo-control">
        <div className={profile.photoDataUrl ? 'photo-preview has-photo' : 'photo-preview'}>
          {profile.photoDataUrl ? <img alt="简历照片预览" src={profile.photoDataUrl} /> : <span>照片</span>}
        </div>
        <div className="photo-actions">
          <label className="button secondary small" htmlFor={photoInputId}>上传照片</label>
          <input
            accept="image/*"
            hidden
            id={photoInputId}
            type="file"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) onPhotoChange(file)
              event.currentTarget.value = ''
            }}
          />
          {profile.photoDataUrl && (
            <button className="text-button" onClick={onPhotoRemove} type="button">
              移除照片
            </button>
          )}
        </div>
      </div>
      <div className="profile-fields">
        <label>
          <span>姓名</span>
          <input value={profile.fullName} onChange={(event) => onUpdate('fullName', event.target.value)} placeholder="例如：张明" />
        </label>
        <label>
          <span>电话</span>
          <input value={profile.phone} onChange={(event) => onUpdate('phone', event.target.value)} placeholder="例如：138 0000 0000" />
        </label>
        <label>
          <span>邮箱</span>
          <input value={profile.email} onChange={(event) => onUpdate('email', event.target.value)} placeholder="name@example.com" />
        </label>
        <label>
          <span>城市</span>
          <input value={profile.city} onChange={(event) => onUpdate('city', event.target.value)} placeholder="例如：上海" />
        </label>
        <label className="profile-field-wide">
          <span>求职意向</span>
          <input value={profile.targetRole} onChange={(event) => onUpdate('targetRole', event.target.value)} placeholder="例如：Rust 后端工程师" />
        </label>
      </div>
    </section>
  )
}

function DraftEditor({
  analyzingModuleId,
  canUndo,
  draftDocument,
  modules,
  moduleSuggestionCounts,
  onAddItem,
  onAnalyzeModule,
  onRemoveItem,
  onSelectModule,
  onUndo,
  onUpdateItem,
  selectedModuleId,
}: {
  analyzingModuleId: string | null
  canUndo: boolean
  draftDocument: DraftDocument
  modules: ResumeModule[]
  moduleSuggestionCounts: Record<string, number>
  onAddItem: (sectionId: string) => void
  onAnalyzeModule: (module: ResumeModule) => void
  onRemoveItem: (sectionId: string, itemId: string) => void
  onSelectModule: (moduleId: string) => void
  onUndo: () => void
  onUpdateItem: (sectionId: string, itemId: string, text: string) => void
  selectedModuleId: string | null
}) {
  return (
    <div className="draft-editor">
      <div className="draft-toolbar">
        <span>当前所有修改都会进入同一份草稿和预览。</span>
        <button className="button secondary small" disabled={!canUndo} onClick={onUndo} type="button">
          撤销最近操作
        </button>
      </div>
      <ResumeModuleList
        analyzingModuleId={analyzingModuleId}
        modules={modules}
        suggestionCounts={moduleSuggestionCounts}
        selectedModuleId={selectedModuleId}
        onAnalyzeModule={onAnalyzeModule}
        onSelectModule={onSelectModule}
      />
      {visibleSections(draftDocument).map((section) => (
        <section className={sectionClassName(section, modules, selectedModuleId)} key={section.sectionId}>
          <div className="section-editor-head">
            <div>
              <span>{sectionTitle[section.sectionType] ?? section.title}</span>
              <strong>{section.items.length} items</strong>
            </div>
            <button className="icon-button" onClick={() => onAddItem(section.sectionId)} type="button" aria-label="新增条目">
              +
            </button>
          </div>
          <div className="item-stack">
            {section.items.map((item) => (
              <label className={item.status === 'needs_review' ? 'resume-item needs-review' : 'resume-item'} key={item.itemId}>
                <span>{item.source === 'ai_suggestion_applied' ? 'AI 改写' : item.source === 'new_experience_inserted' ? '新增经历' : '可编辑文本'}</span>
                <textarea value={item.text} onChange={(event) => onUpdateItem(section.sectionId, item.itemId, event.target.value)} />
                <button className="text-button" onClick={() => onRemoveItem(section.sectionId, item.itemId)} type="button">
                  删除
                </button>
              </label>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function ResumeModuleList({
  analyzingModuleId,
  modules,
  onAnalyzeModule,
  onSelectModule,
  selectedModuleId,
  suggestionCounts,
}: {
  analyzingModuleId: string | null
  modules: ResumeModule[]
  onAnalyzeModule: (module: ResumeModule) => void
  onSelectModule: (moduleId: string) => void
  selectedModuleId: string | null
  suggestionCounts: Record<string, number>
}) {
  if (modules.length === 0) {
    return (
      <section className="module-panel">
        <div className="module-panel-head">
          <strong>简历模块</strong>
          <span>等待解析结果</span>
        </div>
        <p className="module-empty">解析成功后，这里会显示可单独分析的模块。</p>
      </section>
    )
  }

  return (
    <section className="module-panel" aria-label="简历模块列表">
      <div className="module-panel-head">
        <strong>简历模块</strong>
        <span>{modules.length} 个模块</span>
      </div>
      <div className="module-list">
        {modules.map((module) => {
          const isSelected = module.moduleId === selectedModuleId
          const isAnalyzing = module.moduleId === analyzingModuleId
          const suggestionCount = suggestionCounts[module.moduleId] ?? 0
          return (
            <article className={isSelected ? 'module-card selected' : 'module-card'} key={module.moduleId}>
              <button className="module-card-main" onClick={() => onSelectModule(module.moduleId)} type="button">
                <span>{moduleTypeLabel[module.moduleType] ?? module.moduleType}</span>
                <strong>{module.title || moduleTypeLabel[module.moduleType] || '未命名模块'}</strong>
                <small>
                  {moduleStatusLabel[module.status] ?? '待确认'}
                  {suggestionCount > 0 ? ` · ${suggestionCount} 条建议` : ''}
                </small>
              </button>
              <button
                className="button secondary small"
                disabled={Boolean(analyzingModuleId)}
                onClick={() => onAnalyzeModule(module)}
                type="button"
              >
                {isAnalyzing ? '分析中' : '分析此模块'}
              </button>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function WorkExperienceForm({
  disabled,
  onSubmit,
  onUpdate,
  value,
}: {
  disabled: boolean
  onSubmit: () => void
  onUpdate: (field: ExperienceFieldKey, value: string | boolean) => void
  value: NewWorkExperience
}) {
  const validation = validateWorkExperience(value)

  return (
    <div className="work-experience-form">
      <div className="structured-grid">
        <FieldInput
          field="companyName"
          label="公司名"
          onUpdate={onUpdate}
          placeholder="例如：某某科技有限公司"
          required
          value={value.companyName}
        />
        <FieldInput
          field="positionTitle"
          label="职位"
          onUpdate={onUpdate}
          placeholder="例如：后端工程师"
          required
          value={value.positionTitle}
        />
        <FieldInput
          field="employmentStart"
          label="入职开始时间"
          onUpdate={onUpdate}
          placeholder="例如：2023.05"
          required
          value={value.employmentStart}
        />
        <label className="field-control">
          <span>离职结束时间</span>
          <input
            disabled={value.isCurrentRole}
            placeholder={value.isCurrentRole ? '至今' : '例如：2025.12'}
            value={value.isCurrentRole ? '' : value.employmentEnd}
            onChange={(event) => onUpdate('employmentEnd', event.target.value)}
          />
        </label>
        <label className="checkbox-control">
          <input checked={value.isCurrentRole} type="checkbox" onChange={(event) => onUpdate('isCurrentRole', event.target.checked)} />
          <span>当前仍在职</span>
        </label>
        <FieldInput
          field="projectName"
          label="主要项目名称"
          onUpdate={onUpdate}
          placeholder="例如：账单系统性能优化"
          required
          value={value.projectName}
        />
      </div>

      <div className="structured-textareas">
        <FieldTextarea
          field="projectDescription"
          label="项目介绍"
          onUpdate={onUpdate}
          placeholder="这个项目解决了什么业务问题，面向哪些用户或流程。"
          required
          value={value.projectDescription}
        />
        <FieldTextarea
          field="responsibilities"
          label="主要职责"
          onUpdate={onUpdate}
          placeholder="你负责的模块、协作对象、交付范围。"
          required
          value={value.responsibilities}
        />
        <FieldTextarea
          field="actions"
          label="关键动作"
          onUpdate={onUpdate}
          placeholder="你具体做了哪些动作，例如重构缓存、优化 SQL、补充监控。"
          required
          value={value.actions}
        />
        <FieldTextarea
          field="outcomes"
          label="结果或产出"
          onUpdate={onUpdate}
          placeholder="只写真实结果，例如响应时间降低、稳定性提升、上线交付。没有数字也可以写实际产出。"
          required
          value={value.outcomes}
        />
        <FieldTextarea
          field="rawText"
          label="自由描述"
          onUpdate={onUpdate}
          placeholder="补充背景、工具栈或你希望保留的原话。可选。"
          value={value.rawText}
        />
      </div>

      <div className="structured-actions">
        <p>
          {validation.valid
            ? '字段完整后，AI 会基于这些事实判断插入到工作经历或项目经历。插入结果仍需要你确认后才会进入导出。'
            : `还需要补充：${validation.missingLabels.join('、')}。`}
        </p>
        <button className="button primary" disabled={disabled || !validation.valid} onClick={onSubmit} type="button">
          {disabled ? '正在判断位置' : '放入简历'}
        </button>
      </div>
    </div>
  )
}

function FieldInput({
  field,
  label,
  onUpdate,
  placeholder,
  required = false,
  value,
}: {
  field: ExperienceFieldKey
  label: string
  onUpdate: (field: ExperienceFieldKey, value: string) => void
  placeholder: string
  required?: boolean
  value: string
}) {
  return (
    <label className="field-control">
      <span>{label}{required && <b>*</b>}</span>
      <input value={value} onChange={(event) => onUpdate(field, event.target.value)} placeholder={placeholder} />
    </label>
  )
}

function FieldTextarea({
  field,
  label,
  onUpdate,
  placeholder,
  required = false,
  value,
}: {
  field: ExperienceFieldKey
  label: string
  onUpdate: (field: ExperienceFieldKey, value: string) => void
  placeholder: string
  required?: boolean
  value: string
}) {
  return (
    <label className="field-control">
      <span>{label}{required && <b>*</b>}</span>
      <textarea value={value} onChange={(event) => onUpdate(field, event.target.value)} placeholder={placeholder} />
    </label>
  )
}

function ResumePreview({ draftDocument, profile }: { draftDocument: DraftDocument | null; profile: ResumeProfile }) {
  if (!draftDocument) {
    return (
      <div className="preview-empty">
        <PineappleLogo muted size={56} />
        <h2>等待简历草稿</h2>
        <p>粘贴或上传简历后，这里会显示接近最终 PDF 的预览。</p>
      </div>
    )
  }

  const pages = paginateSections(visibleSections(draftDocument).filter((section) => section.sectionType !== 'basic_info'))

  return (
    <div className="resume-pages" aria-label="多页简历预览">
      {pages.map((page) => (
        <article className="resume-paper" key={page.pageNumber}>
          <ResumePaperHeader isFirstPage={page.pageNumber === 1} pageNumber={page.pageNumber} profile={profile} />
          {page.sections.map((section, index) => (
            <section className={index === 0 ? 'paper-section first' : 'paper-section'} key={section.sectionId}>
              <h2>{sectionTitle[section.sectionType] ?? section.title}</h2>
              <div className="paper-items">
                {section.items.map((item) => (
                  <p className={item.status === 'needs_review' ? 'needs-review' : ''} key={item.itemId}>
                    {item.text || '空条目'}
                  </p>
                ))}
              </div>
            </section>
          ))}
          <footer className="paper-footer">Page {page.pageNumber}</footer>
        </article>
      ))}
    </div>
  )
}

function ResumePaperHeader({
  isFirstPage,
  pageNumber,
  profile,
}: {
  isFirstPage: boolean
  pageNumber: number
  profile: ResumeProfile
}) {
  const displayName = profile.fullName.trim() || '姓名'
  const targetRole = profile.targetRole.trim() || '求职意向'
  const contacts = [profile.phone, profile.email, profile.city].map((item) => item.trim()).filter(Boolean)

  if (!isFirstPage) {
    return (
      <header className="paper-running-header">
        <strong>{displayName}</strong>
        <span>{targetRole} · Page {pageNumber}</span>
      </header>
    )
  }

  return (
    <header className="paper-profile-header">
      <div className="paper-profile-copy">
        <h1>{displayName}</h1>
        <p>{targetRole}</p>
        <div className="paper-contact-line">
          {contacts.length > 0 ? contacts.map((item) => <span key={item}>{item}</span>) : <span>电话 / 邮箱 / 城市</span>}
        </div>
      </div>
      <div className={profile.photoDataUrl ? 'paper-photo has-photo' : 'paper-photo'}>
        {profile.photoDataUrl ? <img alt="简历照片" src={profile.photoDataUrl} /> : <span>Photo</span>}
      </div>
    </header>
  )
}

function SuggestionList({
  manualApplyRequired,
  modules,
  onApply,
  onCopy,
  onIgnore,
  suggestions,
}: {
  manualApplyRequired: boolean
  modules: ResumeModule[]
  onApply: (suggestion: Suggestion) => void
  onCopy: (suggestion: Suggestion) => void
  onIgnore: (suggestionId: string) => void
  suggestions: Suggestion[]
}) {
  if (suggestions.length === 0) {
    return (
      <div className="suggestion-empty">
        <span className="ai-dot"></span>
        <strong>暂无待处理建议</strong>
        <p>点击“分析建议”后，AI 会把可执行修改放在这里。</p>
      </div>
    )
  }

  return (
    <div className="suggestion-list">
      {suggestions.map((suggestion) => {
        const applyBlocker = getSuggestionApplyBlocker(suggestion, manualApplyRequired)
        const targetModule = suggestion.targetModuleId ? modules.find((module) => module.moduleId === suggestion.targetModuleId) : null
        return (
          <article className={`suggestion-card ${suggestion.riskLevel}`} key={suggestion.suggestionId}>
            <div className="suggestion-head">
              <span className={`risk ${suggestion.riskLevel}`}>{riskLabel[suggestion.riskLevel]}</span>
              <span className="risk module-tag">
                {targetModule ? `目标：${targetModule.title}` : suggestion.targetModuleType ? `目标：${moduleTypeLabel[suggestion.targetModuleType] ?? suggestion.targetModuleType}` : '目标：整份简历'}
              </span>
              {suggestion.suggestedOperation && (
                <span className="risk operation-tag">{operationLabel[suggestion.suggestedOperation]}</span>
              )}
              {suggestion.extractionStatus === 'partial' && <span className="risk confirm">部分提取</span>}
              {suggestion.extractionStatus === 'failed' && <span className="risk high">提取失败</span>}
              {suggestion.needsUserConfirmation && <span className="risk confirm">需用户确认</span>}
            </div>
            <h3>{localizeBackendText(suggestion.issue)}</h3>
            {suggestion.targetText && <blockquote>{suggestion.targetText}</blockquote>}
            <p>{localizeBackendText(suggestion.recommendation)}</p>
            {suggestion.exampleRewrite && (
              <div className="rewrite-box">
                <span>建议改写</span>
                <p>{suggestion.exampleRewrite}</p>
              </div>
            )}
            <SuggestionGuardrails applyBlocker={applyBlocker} suggestion={suggestion} />
            <div className="button-row">
              <button className="button primary small" disabled={Boolean(applyBlocker)} onClick={() => onApply(suggestion)} type="button">
                应用
              </button>
              {manualApplyRequired && (
                <button className="button secondary small" disabled={!suggestion.exampleRewrite?.trim()} onClick={() => void onCopy(suggestion)} type="button">
                  复制改写
                </button>
              )}
              <button className="button secondary small" onClick={() => onIgnore(suggestion.suggestionId)} type="button">
                忽略
              </button>
            </div>
          </article>
        )
      })}
    </div>
  )
}

function SuggestionGuardrails({ applyBlocker, suggestion }: { applyBlocker: string | null; suggestion: Suggestion }) {
  const questions = suggestion.questions ?? []
  if (!applyBlocker && !suggestion.needsUserInput && !suggestion.blockedReason && questions.length === 0 && !suggestion.source) {
    return null
  }

  return (
    <div className={applyBlocker || suggestion.needsUserInput || suggestion.blockedReason ? 'suggestion-guard blocked' : 'suggestion-guard'}>
      {suggestion.source && (
        <span>{suggestion.source === 'ai_provider' ? '来源：真实 AI provider' : '来源：本地开发兜底，不作为验收建议'}</span>
      )}
      {applyBlocker && <p>{applyBlocker}</p>}
      {suggestion.blockedReason && <p>{localizeBackendText(suggestion.blockedReason)}</p>}
      {suggestion.needsUserInput && <p>这条建议需要你先补充信息，暂不能一键应用。</p>}
      {questions.length > 0 && (
        <ul>
          {questions.map((question) => <li key={question}>{localizeBackendText(question)}</li>)}
        </ul>
      )}
    </div>
  )
}

function WorkflowStrip({
  draftDocument,
  isExported,
  suggestions,
}: {
  draftDocument: DraftDocument | null
  isExported: boolean
  suggestions: Suggestion[]
}) {
  const steps = [
    { label: '导入', active: Boolean(draftDocument) },
    { label: '分析', active: suggestions.length > 0 },
    { label: '编辑', active: Boolean(draftDocument) },
    { label: '新增', active: Boolean(draftDocument?.sections.some((section) => (
      section.items.some((item) => item.source === 'new_experience_inserted')
    ))) },
    { label: '导出', active: isExported },
  ]

  return (
    <div className="workflow-strip">
      {steps.map((step, index) => (
        <div className={step.active ? 'workflow-step active' : 'workflow-step'} key={step.label}>
          <span>{String(index + 1).padStart(2, '0')}</span>
          <strong>{step.label}</strong>
        </div>
      ))}
    </div>
  )
}

function PanelHeader({ eyebrow, meta, title }: { eyebrow: string; meta?: string; title: string }) {
  return (
    <div className="panel-header">
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {meta && <small>{meta}</small>}
    </div>
  )
}

function Stat({ label, tone = 'normal', value }: { label: string; tone?: 'normal' | 'warn'; value: number }) {
  return (
    <div className={`stat ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function PineappleLogo({ muted = false, size = 34 }: { muted?: boolean; size?: number }) {
  return (
    <svg className={muted ? 'pineapple-logo muted' : 'pineapple-logo'} width={size} height={size} viewBox="0 0 64 64" aria-label="AI CV Studio">
      <path className="leaf leaf-left" d="M31 19 L22 9 L29 12 Z" />
      <path className="leaf leaf-mid" d="M33 20 L34 6 L39 16 Z" />
      <path className="leaf leaf-right" d="M36 20 L48 11 L43 22 Z" />
      <path className="body" d="M32 18 C42 20 50 31 47 43 C44 55 36 59 27 56 C18 53 14 43 17 32 C19 24 24 19 32 18 Z" />
      <path className="grid" d="M20 31 L40 55 M17 39 L30 56 M27 20 L47 42 M38 23 L18 43 M45 32 L25 56" />
      <circle className="node" cx="31" cy="38" r="1.8" />
      <circle className="node" cx="37" cy="45" r="1.8" />
    </svg>
  )
}

function getDraftStats(draftDocument: DraftDocument | null) {
  if (!draftDocument) return { items: 0, reviewItems: 0, sections: 0 }
  const sections = visibleSections(draftDocument)
  const items = sections.flatMap((section) => section.items)
  return {
    items: items.length,
    reviewItems: items.filter((item) => item.status === 'needs_review').length,
    sections: sections.length,
  }
}

function hasNeedsReviewItems(sections: ResumeSection[]) {
  return sections.some((section) => (
    section.status === 'needs_review' || section.items.some((item) => item.status === 'needs_review')
  ))
}

function getResumeModules(draftDocument: DraftDocument | null): ResumeModule[] {
  if (!draftDocument) return []
  const modules = draftDocument.modules?.length
    ? draftDocument.modules
    : draftDocument.sections.map((section) => moduleFromSection(section, draftDocument.documentId))

  return modules
    .map((module) => syncModuleWithSection(module, draftDocument.sections.find((section) => section.sectionId === module.sectionId)))
    .filter((module) => module.items.some((item) => item.status !== 'hidden') || module.currentText.trim())
    .sort((left, right) => left.order - right.order)
}

function moduleFromSection(section: ResumeSection, documentId: string): ResumeModule {
  return {
    moduleId: `module_${section.sectionId}`,
    documentId,
    moduleType: section.sectionType as ResumeModuleType,
    title: section.title || sectionTitle[section.sectionType] || '未命名模块',
    sourceText: sectionText(section),
    currentText: sectionText(section),
    items: [...section.items],
    sectionId: section.sectionId,
    order: section.order,
    status: section.status === 'needs_review' ? 'needs_review' : 'normal',
    parseConfidence: 0.72,
  }
}

function syncModuleWithSection(module: ResumeModule, section?: ResumeSection): ResumeModule {
  if (!section) return module
  const currentText = sectionText(section)
  return {
    ...module,
    documentId: module.documentId || section.documentId,
    moduleType: module.moduleType || section.sectionType,
    title: module.title || section.title || sectionTitle[section.sectionType] || '未命名模块',
    currentText,
    items: section.items,
    sectionId: section.sectionId,
    order: section.order,
    status: module.status === 'analyzing' || module.status === 'has_suggestions' || module.status === 'applied' || module.status === 'ignored'
      ? module.status
      : section.status === 'needs_review'
        ? 'needs_review'
        : module.status || 'normal',
  }
}

function sectionText(section: ResumeSection) {
  return section.items
    .filter((item) => item.status !== 'hidden')
    .sort((left, right) => left.order - right.order)
    .map((item) => item.text.trim())
    .filter(Boolean)
    .join('\n')
}

function updateModulesFromSections(
  existingModules: ResumeModule[] | undefined,
  nextSections: ResumeSection[],
  highlightedModuleId?: string,
  highlightedStatus?: ResumeModuleStatus,
): ResumeModule[] {
  const existingBySectionId = new Map((existingModules ?? []).map((module) => [module.sectionId, module]))
  return nextSections
    .map((section) => {
      const existing = existingBySectionId.get(section.sectionId)
      const module = existing
        ? syncModuleWithSection(existing, section)
        : moduleFromSection(section, section.documentId)
      if (highlightedModuleId && module.moduleId === highlightedModuleId && highlightedStatus) {
        return { ...module, status: highlightedStatus }
      }
      if (highlightedStatus === 'applied' && module.status === 'has_suggestions') return { ...module, status: 'normal' as const }
      return module
    })
    .sort((left, right) => left.order - right.order)
}

function updateModuleStatus(modules: ResumeModule[], moduleId: string, status: ResumeModuleStatus) {
  return modules.map((module) => (
    module.moduleId === moduleId ? { ...module, status } : module
  ))
}

function markAllModulesFromSections(existingModules: ResumeModule[] | undefined, sections: ResumeSection[]) {
  return updateModulesFromSections(existingModules, sections).map((module) => ({
    ...module,
    status: module.status === 'needs_review' || module.status === 'has_suggestions' ? 'normal' as const : module.status,
  }))
}

function mergeSuggestions(current: Suggestion[], incoming: Suggestion[], targetModule?: ResumeModule | null) {
  const normalizedIncoming = incoming.map((suggestion) => normalizeIncomingSuggestion(suggestion, targetModule))
  if (!targetModule) return normalizedIncoming

  const replacedSuggestionIds = new Set(normalizedIncoming.map((suggestion) => suggestion.suggestionId))
  return [
    ...current.filter((suggestion) => {
      if (replacedSuggestionIds.has(suggestion.suggestionId)) return false
      if (suggestion.targetModuleId !== targetModule.moduleId) return true
      return suggestion.status === 'applied' || suggestion.status === 'ignored'
    }),
    ...normalizedIncoming,
  ]
}

function normalizeIncomingSuggestion(suggestion: Suggestion, targetModule?: ResumeModule | null): Suggestion {
  if (!targetModule) {
    return {
      ...suggestion,
      status: suggestion.status ?? 'open',
    }
  }

  const pointsOutsideTarget = Boolean(suggestion.targetModuleId && suggestion.targetModuleId !== targetModule.moduleId)
    || Boolean(suggestion.targetSectionId && suggestion.targetSectionId !== targetModule.sectionId)
  return {
    ...suggestion,
    analysisScope: 'module',
    targetModuleId: suggestion.targetModuleId ?? targetModule.moduleId,
    targetModuleType: suggestion.targetModuleType ?? targetModule.moduleType,
    status: pointsOutsideTarget ? 'blocked' : suggestion.status ?? 'open',
    blockedReason: pointsOutsideTarget
      ? suggestion.blockedReason ?? '这条建议指向了当前分析模块之外的内容，不能一键应用。'
      : suggestion.blockedReason,
  }
}

function getModuleSuggestionCounts(modules: ResumeModule[], suggestions: Suggestion[]) {
  const counts: Record<string, number> = Object.fromEntries(modules.map((module) => [module.moduleId, 0]))
  suggestions.forEach((suggestion) => {
    if (!suggestion.targetModuleId) return
    counts[suggestion.targetModuleId] = (counts[suggestion.targetModuleId] ?? 0) + 1
  })
  return counts
}

function sectionClassName(section: ResumeSection, modules: ResumeModule[], selectedModuleId: string | null) {
  const module = modules.find((item) => item.sectionId === section.sectionId)
  return module?.moduleId === selectedModuleId ? 'section-editor selected-module' : 'section-editor'
}

function updateInsertedProposalText(draftDocument: DraftDocument, sectionId: string, text: string) {
  const sections = draftDocument.sections.map((section) => {
    if (section.sectionId !== sectionId) return section
    return {
      ...section,
      items: section.items.map((item, index, items) => {
        if (item.source !== 'new_experience_inserted' || index !== items.length - 1) return item
        return { ...item, text }
      }),
    }
  })

  return {
    ...draftDocument,
    updatedAt: new Date().toISOString(),
    sections,
  }
}

function visibleSections(draftDocument: DraftDocument) {
  return draftDocument.sections
    .filter((section) => section.status !== 'hidden')
    .sort((left, right) => left.order - right.order)
    .map((section) => ({
      ...section,
      items: section.items
        .filter((item) => item.status !== 'hidden')
        .sort((left, right) => left.order - right.order),
    }))
}

function validateWorkExperience(input: NewWorkExperience) {
  const requiredFields: ExperienceFieldKey[] = [
    'companyName',
    'positionTitle',
    'employmentStart',
    'projectName',
    'projectDescription',
    'responsibilities',
    'actions',
    'outcomes',
  ]
  if (!input.isCurrentRole) requiredFields.splice(3, 0, 'employmentEnd')

  const missingLabels = requiredFields
    .filter((field) => !String(input[field]).trim())
    .map((field) => experienceFieldLabel[field])

  return { valid: missingLabels.length === 0, missingLabels }
}

function formatWorkExperienceForApi(input: NewWorkExperience) {
  const end = input.isCurrentRole ? '至今' : input.employmentEnd.trim()
  const lines = [
    `公司：${input.companyName.trim()}`,
    `职位：${input.positionTitle.trim()}`,
    `时间：${input.employmentStart.trim()} - ${end}`,
    `主要项目：${input.projectName.trim()}`,
    `项目介绍：${input.projectDescription.trim()}`,
    `主要职责：${input.responsibilities.trim()}`,
    `关键动作：${input.actions.trim()}`,
    `结果或产出：${input.outcomes.trim()}`,
  ]

  if (input.rawText.trim()) lines.push(`补充描述：${input.rawText.trim()}`)
  return lines.join('\n')
}

function workExperienceFieldName(field: string) {
  return experienceFieldLabel[field as ExperienceFieldKey] ?? field
}

function paginateSections(sections: ResumeSection[]): PreviewPage[] {
  const pages: PreviewPage[] = []
  let currentSections: ResumeSection[] = []
  let currentWeight = 0

  sections.forEach((section) => {
    const sectionWeight = estimateSectionWeight(section)
    const limit = pages.length === 0 ? 1750 : 2100
    if (currentSections.length > 0 && currentWeight + sectionWeight > limit) {
      pages.push({ pageNumber: pages.length + 1, sections: currentSections })
      currentSections = []
      currentWeight = 0
    }

    if (sectionWeight > limit && section.items.length > 1) {
      const chunks = chunkLargeSection(section, limit)
      chunks.forEach((chunk) => {
        if (currentSections.length > 0) {
          pages.push({ pageNumber: pages.length + 1, sections: currentSections })
          currentSections = []
          currentWeight = 0
        }
        pages.push({ pageNumber: pages.length + 1, sections: [chunk] })
      })
      return
    }

    currentSections.push(section)
    currentWeight += sectionWeight
  })

  if (currentSections.length > 0) {
    pages.push({ pageNumber: pages.length + 1, sections: currentSections })
  }

  return pages.length > 0 ? pages : [{ pageNumber: 1, sections: [] }]
}

function estimateSectionWeight(section: ResumeSection) {
  const textLength = section.items.reduce((sum, item) => sum + item.text.length, 0)
  return 180 + section.items.length * 70 + textLength
}

function chunkLargeSection(section: ResumeSection, limit: number) {
  const chunks: ResumeSection[] = []
  let items: ResumeItem[] = []
  let weight = 180

  section.items.forEach((item) => {
    const itemWeight = 70 + item.text.length
    if (items.length > 0 && weight + itemWeight > limit) {
      chunks.push({ ...section, sectionId: `${section.sectionId}_page_${chunks.length + 1}`, items })
      items = []
      weight = 180
    }
    items.push(item)
    weight += itemWeight
  })

  if (items.length > 0) {
    chunks.push({ ...section, sectionId: `${section.sectionId}_page_${chunks.length + 1}`, items })
  }

  return chunks
}

function itemTypeForSection(sectionType: ResumeSection['sectionType']): ResumeItem['itemType'] {
  if (sectionType === 'summary') return 'paragraph'
  if (sectionType === 'skills') return 'skill_group'
  if (sectionType === 'work_experience' || sectionType === 'project_experience') return 'experience_entry'
  return 'list_item'
}

function mergeProfileFromDraft(current: ResumeProfile, draftDocument: DraftDocument, fallbackName: string | null, sourceText = ''): ResumeProfile {
  const draftText = visibleSections(draftDocument).flatMap((section) => section.items.map((item) => item.text)).join('\n')
  const text = [sourceText, draftText].filter(Boolean).join('\n')
  const sourceLines = profileLines(sourceText)
  const lines = profileLines(text)
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? ''
  const phone = text.match(/(?:\+?86[-\s]?)?1[3-9]\d[\s-]?\d{4}[\s-]?\d{4}/)?.[0] ?? ''
  const city = extractProfileField(lines, ['城市', '所在地', '现居地', 'City', 'Location']) || inferCity(text)
  const nameFromFile = cleanNameFromFile(fallbackName)
  const fullName = extractProfileField(lines, ['姓名', '名字', 'Name', 'Full Name'])
    || inferFullName(sourceLines)
    || inferFullName(lines)
    || nameFromFile
  const targetRole = extractProfileField(lines, ['求职意向', '目标岗位', '意向岗位', '应聘岗位', '职位目标', 'Target Role', 'Desired Role', 'Objective'])
    || inferTargetRole(sourceLines)
    || inferTargetRole(lines)

  return {
    fullName: current.fullName || fullName,
    phone: current.phone || phone,
    email: current.email || email,
    city: current.city || city,
    targetRole: current.targetRole || targetRole,
    photoDataUrl: current.photoDataUrl,
  }
}

function profileLines(text: string) {
  return text.split(/\n+/).map((line) => line.trim()).filter(Boolean)
}

function extractProfileField(lines: string[], labels: string[]) {
  for (const line of lines) {
    const normalized = line.replace(/\s+/g, ' ').trim()
    for (const label of labels) {
      const pattern = new RegExp(`^${escapeRegExp(label)}\\s*(?:[:：|｜-]\\s*)?(.+)$`, 'i')
      const match = normalized.match(pattern)
      if (match?.[1]) return cleanProfileValue(match[1])
    }
  }
  return ''
}

function inferFullName(lines: string[]) {
  return lines.find((line) => {
    const value = cleanProfileValue(line)
    if (!value || value.length > 32) return false
    if (isResumeSectionTitle(value) || isContactLine(value) || isLikelyTargetRole(value)) return false
    if (/[:：@/|｜,，]/.test(value)) return false
    return /^[\u4e00-\u9fff]{2,4}(?:[·•][\u4e00-\u9fff]{1,4})?$/.test(value)
      || /^[A-Za-z][A-Za-z.'-]+(?:\s+[A-Za-z][A-Za-z.'-]+){1,3}$/.test(value)
  }) ?? ''
}

function inferCity(text: string) {
  const knownCities = ['北京', '上海', '广州', '深圳', '杭州', '南京', '成都', '武汉', '西安', '苏州', '重庆', '天津']
  return knownCities.find((city) => text.includes(city)) ?? ''
}

function inferTargetRole(lines: string[]) {
  const targetLine = lines.find((line) => {
    const value = cleanProfileValue(line)
    return !isContactLine(value) && isLikelyTargetRole(value) && value.length <= 48
  })
  return targetLine ? stripProfileLabel(targetLine) : ''
}

function cleanNameFromFile(name: string | null) {
  if (!name) return ''
  const value = name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ').trim()
  return inferFullName([value])
}

function cleanProfileValue(value: string) {
  return stripProfileLabel(value).replace(/\s+/g, ' ').trim()
}

function stripProfileLabel(value: string) {
  return value.replace(/^(姓名|名字|Name|Full Name|电话|手机|邮箱|城市|所在地|现居地|求职意向|目标岗位|意向岗位|应聘岗位|职位目标|Target Role|Desired Role|Objective)\s*[:：|｜-]?\s*/i, '').trim()
}

function isContactLine(value: string) {
  return /@|(?:\+?86[-\s]?)?1[3-9]\d[\s-]?\d{4}[\s-]?\d{4}|电话|手机|邮箱|城市|所在地|现居地|City|Location/i.test(value)
}

function isResumeSectionTitle(value: string) {
  return /^(基本信息|个人信息|个人总结|工作经历|项目经历|教育经历|技能|证书|其他|Basic Info|Summary|Work Experience|Project Experience|Education|Skills|Certifications|Additional)$/i.test(value)
}

function isLikelyTargetRole(value: string) {
  return /工程师|设计师|产品经理|运营|分析师|开发|前端|后端|全栈|数据|销售|市场|Engineer|Designer|Manager|Developer|Analyst/i.test(value)
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeError(caught: unknown, fallbackTitle: string): AppError {
  if (caught instanceof ApiClientError) {
    if (caught.status === 401) {
      return {
        title: '访问口令无效或未配置',
        details: '请确认朋友试用口令是否正确。保存口令后可以直接重试，当前编辑内容已保留。',
      }
    }
    if (caught.status >= 500) {
      return {
        title: fallbackTitle,
        details: '服务暂时没有完成处理，请稍后重试；你的编辑内容已保留。',
      }
    }
    return {
      title: localizeBackendText(caught.message) || fallbackTitle,
      details: localizeBackendText(caught.details) || '请检查输入内容后重试。',
    }
  }
  if (caught instanceof Error) {
    const message = caught.message.toLowerCase()
    if (message.includes('failed to fetch') || message.includes('networkerror') || message.includes('load failed')) {
      return {
        title: fallbackTitle,
        details: '暂时连接不上后端服务，请确认本地后端已启动后重试；你的编辑内容已保留。',
      }
    }
    return { title: fallbackTitle, details: '操作暂时失败，请稍后重试；你的编辑内容已保留。' }
  }
  return { title: fallbackTitle, details: '请稍后重试。' }
}

function canFallbackToPlainAnalyze(caught: unknown) {
  return caught instanceof ApiClientError
    && (caught.status === 404 || caught.status === 405 || caught.code === 'stream_unavailable' || caught.code === 'stream_incomplete')
}

function analysisStageLabel(stage: string) {
  const labels: Record<string, string> = {
    starting: '准备分析',
    validating: '校验简历',
    calling_ai: '调用 AI',
    finalizing: '整理建议',
    done: '分析完成',
    error: '分析失败',
  }
  return labels[stage] ?? '分析进度'
}

function aiProviderNotConfiguredError(title: string): AppError {
  return {
    title,
    details: '后端还没有可用的真实 AI provider。请在“模型设置”中填写自己的模型 key，或配置后端默认 key；你的编辑内容已保留。',
  }
}

function getModelCapability(
  config: AiProviderConfigResponse | null,
  capability: AiProviderCapabilityResponse | null,
  hasUserAiKey: boolean,
): AiCapabilityStatus {
  if (!hasUserAiKey) return 'full'
  return normalizeCapabilityStatus(capability?.capabilityStatus ?? config?.capabilityStatus)
}

function normalizeCapabilityStatus(value: string | null | undefined): AiCapabilityStatus {
  if (value === 'full' || value === 'basic' || value === 'unsupported') return value
  return 'unknown'
}

function getModelCapabilityBlocker(capability: AiCapabilityStatus, hasUserAiKey: boolean): AppError | null {
  if (!hasUserAiKey) return null
  if (capability === 'full' || capability === 'basic') return null
  if (capability === 'unsupported') {
    return {
      title: '当前模型不支持简历分析',
      details: '当前模型无法返回结构化建议，请更换支持文本生成和 JSON 输出的模型，或清除用户 key 后改用默认模型。已解析草稿不会丢失。',
    }
  }
  return {
    title: '需要先检测模型能力',
    details: '用户模型 key 已保存，但还没有确认它能生成结构化简历建议。请在“模型设置”里点击“检测模型能力”，通过后再分析；已解析草稿不会丢失。',
  }
}

function capabilityStatusLabel(status: AiCapabilityStatus) {
  const labels: Record<AiCapabilityStatus, string> = {
    full: '完整支持简历分析',
    basic: '基础支持，需谨慎使用',
    unsupported: '不支持简历分析',
    unknown: '尚未检测模型能力',
  }
  return labels[status]
}

function capabilityStatusDescription(status: AiCapabilityStatus, blockedReason?: string | null) {
  if (status === 'full') return '当前模型可用于结构化简历分析、新增经历插入和一键应用建议。'
  if (status === 'basic') return '当前模型能生成文本，但结构化建议质量可能不稳定；建议只能复制或手动编辑，不会直接写入简历。'
  if (status === 'unsupported') return localizeBackendText(blockedReason) || '当前模型无法返回结构化建议，请更换支持文本生成和 JSON 输出的模型。'
  return '保存用户模型 key 后需要运行一次轻量检测，通过后才能进入完整分析流程。'
}

function isAiAnalysisUnavailable(health: HealthResponse | null, hasUserAiKey: boolean) {
  if (!health) return false
  if (hasUserAiKey) return false
  if (typeof health.aiAnalysisAvailable === 'boolean') return !health.aiAnalysisAvailable
  return health.aiProviderConfigured === false
}

function resolveAiKeyMode(health: HealthResponse | null, hasUserAiKey: boolean): AiKeyMode | undefined {
  if (hasUserAiKey) return 'user_session_key'
  if (health?.aiProviderConfigured) return 'owner_default'
  return undefined
}

function validateAiProviderForm(input: AiProviderForm) {
  const missing: string[] = []
  if (!input.baseUrl.trim()) missing.push('base URL')
  if (!input.apiKey.trim()) missing.push('API key')
  return { valid: missing.length === 0, missing }
}

function loadStoredAiProviderForm(): AiProviderForm {
  if (typeof window === 'undefined') return defaultAiProviderForm
  try {
    const raw = window.localStorage.getItem(AI_PROVIDER_STORAGE_KEY)
    if (!raw) return defaultAiProviderForm
    const parsed = JSON.parse(raw) as Partial<AiProviderForm>
    return {
      provider: parsed.provider || defaultAiProviderForm.provider,
      baseUrl: parsed.baseUrl || defaultAiProviderForm.baseUrl,
      model: parsed.model || defaultAiProviderForm.model,
      wireApi: normalizeWireApi(parsed.wireApi),
      responseFormat: normalizeResponseFormat(parsed.responseFormat),
      apiKey: parsed.apiKey || defaultAiProviderForm.apiKey,
      rememberInBrowser: true,
    }
  } catch {
    return defaultAiProviderForm
  }
}

function normalizeWireApi(value: unknown): AiWireApi {
  return value === 'chat_completions' ? 'chat_completions' : 'responses'
}

function normalizeResponseFormat(value: unknown): AiResponseFormat {
  if (value === 'json_schema' || value === 'json_object' || value === 'plain_json') return value
  return 'auto'
}

function wireApiLabel(value: string) {
  return value === 'chat_completions' ? 'Chat Completions' : 'Responses'
}

function saveStoredAiProviderForm(input: AiProviderForm) {
  window.localStorage.setItem(AI_PROVIDER_STORAGE_KEY, JSON.stringify(input))
}

function clearStoredAiProviderForm() {
  window.localStorage.removeItem(AI_PROVIDER_STORAGE_KEY)
}

function isSafeSuggestionRewrite(rewrite: string | null | undefined) {
  if (!rewrite?.trim()) return false
  const blockedPhrases = [
    '补充你确认',
    '你确认过',
    '如果你有',
    '需要确认',
    '请补充',
    '结果或范围',
    'confirmed result',
    'added by you',
    'if you have',
  ]
  const lower = rewrite.toLowerCase()
  return !blockedPhrases.some((phrase) => lower.includes(phrase.toLowerCase()))
}

function getSuggestionApplyBlocker(suggestion: Suggestion, manualApplyRequired = false) {
  if (manualApplyRequired) return '当前模型只通过基础能力检测，不能一键应用建议。请复制改写后手动确认并编辑。'
  if (suggestion.status === 'blocked') return '后端已阻断这条建议的一键应用，请按建议说明手动处理。'
  if (suggestion.extractionStatus === 'failed') return 'AI 回复没有被可靠提取成结构化建议，请重试或更换模型。'
  if (suggestion.suggestedOperation === 'move_to_module') return '这条建议涉及移动到其他模块，需要你确认目标模块，暂不能一键应用。'
  if (suggestion.suggestedOperation === 'split_module') return '这条建议涉及拆分模块，需要先查看差异，暂不能一键应用。'
  if (suggestion.suggestedOperation === 'merge_with_module') return '这条建议涉及合并模块，需要先查看差异，暂不能一键应用。'
  if (!suggestion.targetItemId) return '这条建议没有绑定到具体简历条目，需要手动编辑对应内容。'
  if (!suggestion.exampleRewrite?.trim()) return '这条建议没有可直接写入简历的改写文本。'
  if (!isSafeSuggestionRewrite(suggestion.exampleRewrite)) return '建议改写里仍包含提示语，需要先手动改成可以直接进入简历的成品句。'
  if (suggestion.blockedReason) return localizeBackendText(suggestion.blockedReason)
  if (suggestion.needsUserInput) return 'AI 标记这条建议需要你补充信息，不能直接写入可导出的简历。'
  return null
}

function isUnauthorizedError(caught: unknown) {
  return caught instanceof ApiClientError && caught.status === 401
}

function supportedBackendFileName(name: string | null) {
  if (!name) return undefined
  const extension = fileExtension(name)
  if (extension === 'txt' || extension === 'md' || extension === 'pdf' || extension === 'docx') return name
  return undefined
}

function supportedBackendMimeType(name: string | null) {
  if (!name) return undefined
  const extension = fileExtension(name)
  if (extension === 'md') return 'text/markdown'
  if (extension === 'txt') return 'text/plain'
  if (extension === 'pdf') return 'application/pdf'
  if (extension === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  return undefined
}

function fileExtension(name: string) {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

function emptyResumeError(): AppError {
  return {
    title: '简历内容太短',
    details: `请至少粘贴 ${minimumResumeChars} 个字符的简历正文，或上传可读取文本的 TXT / Markdown / PDF / DOCX 文件。`,
  }
}

function importFooterText(fileName: string | null) {
  if (!fileName) return '支持 TXT / Markdown / PDF / DOCX；扫描版 PDF 可能需要复制正文后粘贴'
  const extension = fileExtension(fileName)
  if (extension === 'pdf' || extension === 'docx') return `已读取 ${fileName}，请确认文本区内容是否完整`
  return `已读取 ${fileName}`
}

async function extractResumeText(file: File, extension: string) {
  if (extension === 'pdf') return extractPdfText(file)
  if (extension === 'docx') return extractDocxText(file)
  return file.text()
}

async function extractPdfText(file: File) {
  const pdfjs = await import('pdfjs-dist')
  const pdfWorkerUrl = await import('pdfjs-dist/build/pdf.worker.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl.default

  const data = await file.arrayBuffer()
  const document = await pdfjs.getDocument({ data }).promise
  const pages: string[] = []

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/[ \t]+/g, ' ')
      .trim()
    if (pageText) pages.push(pageText)
  }

  await document.destroy()
  return pages.join('\n\n')
}

async function extractDocxText(file: File) {
  const { default: mammoth } = await import('mammoth/mammoth.browser')
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  return result.value.trim()
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result ?? '')))
    reader.addEventListener('error', () => reject(new Error('浏览器无法读取这张照片，请换一张图片重试。')))
    reader.readAsDataURL(file)
  })
}

function uploadExtractionFallbackDetails(extension: string) {
  if (extension === 'pdf') {
    return '这个 PDF 可能是扫描版图片，浏览器没有读出可分析的文字。请使用可复制文字的 PDF，或从文件里复制简历正文后粘贴。'
  }
  if (extension === 'docx') {
    return '这个 DOCX 没有读出足够的正文。请确认文件内容不是图片，或复制简历正文后粘贴。'
  }
  return '这个文件没有读出足够的可用正文。请补充简历内容，或复制完整正文后粘贴。'
}

function draftPdfFileName(draftDocument: DraftDocument, profile: ResumeProfile) {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '')
  const identity = [profile.fullName, profile.targetRole]
    .map((item) => fileNameSegment(item))
    .filter(Boolean)
    .slice(0, 2)
    .join('-')
  const prefix = identity || 'resume'
  return `${date}-${prefix}-${draftDocument.documentId}-r${draftDocument.revision}.pdf`
}

function fileNameSegment(value: string) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|#%{}$!'@+`=]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 36)
}

function printPreviewAsPdf(fileName: string) {
  const previousTitle = document.title
  document.title = fileName.replace(/\.pdf$/i, '')
  window.print()
  window.setTimeout(() => {
    document.title = previousTitle
  }, 500)
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export default App
