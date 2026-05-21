import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ApiClientError,
  api,
  hasAccessToken,
  setAccessToken,
  type DraftDocument,
  type ExportFormat,
  type ExportResponse,
  type HealthResponse,
  type InsertProposal,
  type ResumeItem,
  type ResumeSection,
  type ResumeSectionStatus,
  type RiskLevel,
  type Suggestion,
} from './api'
import './App.css'
import { localizeBackendText, localizeBackendTexts } from './localization'

type WorkflowStatus =
  | 'idle'
  | 'uploading'
  | 'parsing'
  | 'editing'
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

type BrowserPdfExport = {
  fileName: string
  contentType: string
  createdAt: string
}

const minimumResumeChars = 40
const minimumExperienceChars = 40

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
  editing: '编辑中',
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

const riskLabel: Record<RiskLevel, string> = {
  low: '低风险',
  medium: '需确认',
  high: '高风险',
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
  const [newExperience, setNewExperience] = useState('')
  const [insertProposal, setInsertProposal] = useState<InsertProposal | null>(null)
  const [exportState, setExportState] = useState<ExportResponse | null>(null)
  const [browserPdfExport, setBrowserPdfExport] = useState<BrowserPdfExport | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [draftHistory, setDraftHistory] = useState<DraftDocument[]>([])
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
  const activeSuggestions = suggestions.filter((suggestion) => suggestion.status === 'open')
  const appliedSuggestions = suggestions.filter((suggestion) => suggestion.status === 'applied')
  const canUseBackend = health?.ok === true

  function saveAccessToken() {
    setAccessToken(accessTokenInput)
    setNeedsAccessToken(!accessTokenInput.trim())
    setError(null)
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
      replaceDraftDocument(response.draftDocument, false)
      setWarnings(localizeBackendTexts(response.warnings))
      setSuggestions([])
      setInsertProposal(null)
      setStatus('editing')
      return response.draftDocument
    } catch (caught) {
      if (isUnauthorizedError(caught)) setNeedsAccessToken(true)
      setStatus('failed')
      setError(normalizeError(caught, '简历解析失败'))
      return null
    }
  }

  async function analyzeResume() {
    const activeDraft = draftDocument ?? await parseDraftFromText()
    if (!activeDraft) return

    setError(null)
    setStatus('analyzing')
    try {
      const response = await api.analyzeResume({
        sessionId: activeDraft.sessionId,
        draftDocument: activeDraft,
        analysisGoal: 'improve_clarity',
      })
      setSuggestions(response.suggestions)
      setStatus('editing')
    } catch (caught) {
      if (isUnauthorizedError(caught)) setNeedsAccessToken(true)
      setStatus('failed')
      setError(normalizeError(caught, 'AI 分析失败'))
    }
  }

  async function insertExperience() {
    if (!draftDocument) {
      setError({ title: '还没有简历草稿', details: '请先粘贴或上传简历，解析成可编辑草稿。' })
      return
    }

    const text = newExperience.trim()
    if (text.length < minimumExperienceChars) {
      setError({
        title: '新增经历太短',
        details: `请写清楚你的角色、动作和结果，至少 ${minimumExperienceChars} 个字符。`,
      })
      return
    }

    setError(null)
    setStatus('inserting')
    try {
      const response = await api.insertExperience({
        sessionId: draftDocument.sessionId,
        draftDocument,
        newExperience: text,
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
    setNewExperience('')
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
      }
    })
    setExportState(null)
    setBrowserPdfExport(null)
  }

  function addItem(sectionId: string) {
    setDraftDocument((current) => {
      if (!current) return current
      setDraftHistory((history) => [...history.slice(-9), current])
      return {
        ...current,
        revision: current.revision + 1,
        hasUnconfirmedChanges: hasNeedsReviewItems(current.sections),
        updatedAt: new Date().toISOString(),
        sections: current.sections.map((section) => {
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
        }),
      }
    })
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
      }
    })
  }

  function applySuggestion(suggestion: Suggestion) {
    if (!draftDocument || !suggestion.targetItemId || !suggestion.exampleRewrite) return
    if (!isSafeSuggestionRewrite(suggestion.exampleRewrite)) {
      setError({
        title: '这条建议不能直接应用',
        details: '建议改写里仍包含提示语，需要先手动改成可以直接进入简历的成品句。',
      })
      return
    }
    replaceDraftDocument({
      ...draftDocument,
      revision: draftDocument.revision + 1,
      hasUnconfirmedChanges: suggestion.needsUserConfirmation || hasNeedsReviewItems(draftDocument.sections),
      updatedAt: new Date().toISOString(),
      sections: draftDocument.sections.map((section) => ({
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
      })),
    })
    setSuggestions((current) => current.map((item) => (
      item.suggestionId === suggestion.suggestionId ? { ...item, status: 'applied' } : item
    )))
  }

  function ignoreSuggestion(suggestionId: string) {
    setSuggestions((current) => current.map((item) => (
      item.suggestionId === suggestionId ? { ...item, status: 'ignored' } : item
    )))
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
      }
    })
    setExportState(null)
    setBrowserPdfExport(null)
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
        fileName: draftPdfFileName(draftDocument),
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
        setStatus('failed')
      } else {
        setError(null)
        setStatus('idle')
      }
    } catch (caught) {
      setError({
        title: '文件读取失败',
        details: caught instanceof Error ? localizeBackendText(caught.message) : '浏览器无法读取这个文件，请复制简历正文后粘贴。',
      })
      setStatus('failed')
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
          <button className="button primary" disabled={!canUseBackend || status === 'analyzing'} onClick={analyzeResume} type="button">
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
                <DraftEditor
                  draftDocument={draftDocument}
                  onAddItem={addItem}
                  onRemoveItem={removeItem}
                  onUpdateItem={updateItemText}
                  onUndo={undoLastDraftChange}
                  canUndo={draftHistory.length > 0}
                />
              ) : (
                <ImportPanel
                  fileName={fileName}
                  onAnalyze={analyzeResume}
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
              <ResumePreview draftDocument={draftDocument} />
            </section>
          </div>

          <section className="panel add-panel">
              <PanelHeader eyebrow="Add experience" title="新增经历" meta="AI placement" />
            <div className="add-experience-grid">
              <textarea
                placeholder="写一段真实新增经历，例如：我负责 Redis 缓存优化，把账单接口平均响应时间从 800ms 降到 300ms，并补充了监控告警。"
                value={newExperience}
                onChange={(event) => setNewExperience(event.target.value)}
              />
              <div className="add-side">
                <p>AI 会判断这段内容应该放进工作经历、项目经历或技能区。插入结果需要你确认后才会进入导出。</p>
                <button className="button primary" disabled={status === 'inserting'} onClick={insertExperience} type="button">
                  {status === 'inserting' ? '正在判断位置' : '放入简历'}
                </button>
              </div>
            </div>
          </section>
        </section>

        <aside className="assistant-panel" aria-label="AI 优化建议">
          <section className="panel insight-panel">
            <PanelHeader eyebrow="AI suggestions" title="优化建议" meta={`${activeSuggestions.length} open`} />
            <SuggestionList
              onApply={applySuggestion}
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

function DraftEditor({
  canUndo,
  draftDocument,
  onAddItem,
  onRemoveItem,
  onUndo,
  onUpdateItem,
}: {
  canUndo: boolean
  draftDocument: DraftDocument
  onAddItem: (sectionId: string) => void
  onRemoveItem: (sectionId: string, itemId: string) => void
  onUndo: () => void
  onUpdateItem: (sectionId: string, itemId: string, text: string) => void
}) {
  return (
    <div className="draft-editor">
      <div className="draft-toolbar">
        <span>当前所有修改都会进入同一份草稿和预览。</span>
        <button className="button secondary small" disabled={!canUndo} onClick={onUndo} type="button">
          撤销最近操作
        </button>
      </div>
      {visibleSections(draftDocument).map((section) => (
        <section className="section-editor" key={section.sectionId}>
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

function ResumePreview({ draftDocument }: { draftDocument: DraftDocument | null }) {
  if (!draftDocument) {
    return (
      <div className="preview-empty">
        <PineappleLogo muted size={56} />
        <h2>等待简历草稿</h2>
        <p>粘贴或上传简历后，这里会显示接近最终 PDF 的预览。</p>
      </div>
    )
  }

  return (
    <article className="resume-paper">
      {visibleSections(draftDocument).map((section, index) => (
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
    </article>
  )
}

function SuggestionList({
  onApply,
  onIgnore,
  suggestions,
}: {
  onApply: (suggestion: Suggestion) => void
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
      {suggestions.map((suggestion) => (
        <article className={`suggestion-card ${suggestion.riskLevel}`} key={suggestion.suggestionId}>
          <div className="suggestion-head">
            <span className={`risk ${suggestion.riskLevel}`}>{riskLabel[suggestion.riskLevel]}</span>
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
          <div className="button-row">
            <button className="button primary small" disabled={!isSafeSuggestionRewrite(suggestion.exampleRewrite)} onClick={() => onApply(suggestion)} type="button">
              应用
            </button>
            <button className="button secondary small" onClick={() => onIgnore(suggestion.suggestionId)} type="button">
              忽略
            </button>
          </div>
        </article>
      ))}
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

function itemTypeForSection(sectionType: ResumeSection['sectionType']): ResumeItem['itemType'] {
  if (sectionType === 'summary') return 'paragraph'
  if (sectionType === 'skills') return 'skill_group'
  if (sectionType === 'work_experience' || sectionType === 'project_experience') return 'experience_entry'
  return 'list_item'
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

function uploadExtractionFallbackDetails(extension: string) {
  if (extension === 'pdf') {
    return '这个 PDF 可能是扫描版图片，浏览器没有读出可分析的文字。请使用可复制文字的 PDF，或从文件里复制简历正文后粘贴。'
  }
  if (extension === 'docx') {
    return '这个 DOCX 没有读出足够的正文。请确认文件内容不是图片，或复制简历正文后粘贴。'
  }
  return '这个文件没有读出足够的可用正文。请补充简历内容，或复制完整正文后粘贴。'
}

function draftPdfFileName(draftDocument: DraftDocument) {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '')
  return `${date}-${draftDocument.documentId}-r${draftDocument.revision}.pdf`
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
