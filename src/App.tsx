import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ApiClientError,
  api,
  type BulletStatus,
  type EvidenceItem,
  type ExportFormat,
  type FollowUpQuestion,
  type GeneratedBullet,
  type HealthResponse,
  type JobMatchResponse,
  type Locale,
  type MaterialSet,
  type Profile,
  type ResumeDirection,
  type SessionSummary,
} from './api'
import './App.css'

type StepId = 'start' | 'profile' | 'job' | 'match' | 'questions' | 'resume' | 'review' | 'export'
type AsyncStatus = 'idle' | 'editing' | 'uploading' | 'analyzing' | 'needs_evidence' | 'ready_to_generate' | 'generating' | 'generated' | 'failed'

type AppError = {
  title: string
  details: string
}

type ExportState = {
  format: ExportFormat
  content?: string
  fileName?: string
  contentType?: string
  contentBase64?: string
  excludedCount?: number
}

const steps: Array<{ id: StepId; label: string; short: string }> = [
  { id: 'start', label: '开始与隐私', short: '开始' },
  { id: 'profile', label: '导入经历', short: '档案' },
  { id: 'job', label: '目标岗位', short: 'JD' },
  { id: 'match', label: '匹配缺口', short: '匹配' },
  { id: 'questions', label: 'AI 追问', short: '追问' },
  { id: 'resume', label: '生成简历', short: '生成' },
  { id: 'review', label: '来源审查', short: '审查' },
  { id: 'export', label: '复制导出', short: '导出' },
]

const sampleResume = [
  '负责 Rust 后端 API 性能优化，重构缓存和 SQL 查询，将接口响应时间从 900ms 降到 300ms。',
  '主导跨团队接口稳定性项目，和产品、前端、数据团队协作上线监控告警。',
  '参与用户增长数据分析，使用 SQL 和仪表盘定位转化漏斗问题。',
].join('\n')

const sampleJob = [
  '负责 Rust 后端 API 设计、性能优化、SQL 数据库查询优化、可观测性建设。',
  '需要与产品和前端团队协作交付可靠服务，能够分析接口响应时间和稳定性问题。',
  '熟悉 Docker、Kubernetes 或云基础设施，有生产系统性能优化经验优先。',
].join('\n')

const statusText: Record<AsyncStatus, string> = {
  idle: '未开始',
  editing: '编辑中',
  uploading: '上传中',
  analyzing: '分析中',
  needs_evidence: '需要证据',
  ready_to_generate: '可生成',
  generating: '生成中',
  generated: '已生成',
  failed: '失败',
}

const bulletStatusText: Record<BulletStatus, string> = {
  supported: '已支持',
  needs_confirmation: '需要确认',
  needs_evidence: '证据不足',
  blocked: '已阻断',
}

const directionOptions: Array<{ value: ResumeDirection; label: string; description: string }> = [
  { value: 'business_impact', label: '业务影响', description: '突出结果、指标和影响范围。' },
  { value: 'ats_clarity', label: 'ATS 清晰度', description: '强调关键词和可解析表达。' },
  { value: 'technical_depth', label: '技术深度', description: '突出工具、系统和复杂度。' },
  { value: 'concise', label: '简洁表达', description: '压缩成更短的投递版本。' },
]

const fileMimeFallback: Record<string, string> = {
  txt: 'text/plain',
  md: 'text/markdown',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

function App() {
  const [locale, setLocale] = useState<Locale>('zh')
  const [targetLanguage, setTargetLanguage] = useState<Locale>('zh')
  const [currentStep, setCurrentStep] = useState<StepId>('start')
  const [status, setStatus] = useState<AsyncStatus>('idle')
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [session, setSession] = useState<SessionSummary | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [evidenceItems, setEvidenceItems] = useState<EvidenceItem[]>([])
  const [questions, setQuestions] = useState<FollowUpQuestion[]>([])
  const [jobMatch, setJobMatch] = useState<JobMatchResponse | null>(null)
  const [materialSet, setMaterialSet] = useState<MaterialSet | null>(null)
  const [exportState, setExportState] = useState<ExportState | null>(null)
  const [resumeText, setResumeText] = useState(sampleResume)
  const [fileName, setFileName] = useState<string>()
  const [fileMimeType, setFileMimeType] = useState<string>()
  const [manualAnswer, setManualAnswer] = useState('')
  const [companyName, setCompanyName] = useState('Example SaaS')
  const [jobTitle, setJobTitle] = useState('Rust Backend Engineer')
  const [jobDescription, setJobDescription] = useState(sampleJob)
  const [direction, setDirection] = useState<ResumeDirection>('business_impact')
  const [maxBullets, setMaxBullets] = useState(8)
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({})
  const [confirmedBulletIds, setConfirmedBulletIds] = useState<string[]>([])
  const [error, setError] = useState<AppError | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    api
      .health()
      .then(setHealth)
      .catch((caught) => setError(normalizeError(caught, '后端健康检查失败')))
  }, [])

  const currentStepIndex = steps.findIndex((step) => step.id === currentStep)
  const openQuestions = questions.filter((question) => question.status === 'open')
  const highPriorityQuestions = openQuestions.filter((question) => question.priority === 'high')
  const exportableBullets = useMemo(() => {
    return (materialSet?.bullets ?? []).filter((bullet) => {
      if (bullet.status === 'supported') return true
      return bullet.status === 'needs_confirmation' && confirmedBulletIds.includes(bullet.bulletId)
    })
  }, [confirmedBulletIds, materialSet])
  const blockedBullets = useMemo(() => {
    return (materialSet?.bullets ?? []).filter((bullet) => bullet.status === 'blocked' || bullet.status === 'needs_evidence')
  }, [materialSet])
  const needsConfirmationBullets = useMemo(() => {
    return (materialSet?.bullets ?? []).filter((bullet) => bullet.status === 'needs_confirmation')
  }, [materialSet])
  const completedEvidenceCount = evidenceItems.filter((item) => !item.needsUserConfirmation).length

  async function ensureSession() {
    if (session) return session
    const response = await api.createSession({ locale, targetLanguage })
    setSession(response.session)
    return response.session
  }

  async function startFlow() {
    setError(null)
    setStatus('analyzing')
    try {
      await ensureSession()
      setCurrentStep('profile')
      setStatus('editing')
    } catch (caught) {
      setStatus('failed')
      setError(normalizeError(caught, '创建会话失败'))
    }
  }

  async function handleFile(file: File) {
    setError(null)
    setFileName(file.name)
    setFileMimeType(file.type || mimeFromFileName(file.name))
    const extension = file.name.split('.').pop()?.toLowerCase()

    if (extension !== 'txt' && extension !== 'md') {
      setResumeText('')
      setStatus('editing')
      setError({
        title: '请改用粘贴文本继续',
        details: '后端 V1 接收解析后的文本。PDF 和 DOCX 暂不在前端直接解析，请复制其中的简历正文粘贴到文本框。',
      })
      return
    }

    const text = await file.text()
    setResumeText(text)
  }

  async function submitProfile() {
    setError(null)
    const trimmedResume = resumeText.trim()
    const trimmedManual = manualAnswer.trim()

    if (trimmedResume.length < 12 && trimmedManual.length < 12) {
      setError({
        title: '经历内容太短',
        details: '请至少粘贴一段工作经历、项目经历、教育经历或技能证据。',
      })
      return
    }

    setStatus(fileName ? 'uploading' : 'analyzing')
    try {
      const activeSession = await ensureSession()
      const response = fileName && trimmedResume
        ? await api.parseResume({
            sessionId: activeSession.sessionId,
            locale,
            targetLanguage,
            fileName,
            mimeType: fileMimeType,
            resumeText: trimmedResume,
          })
        : await api.profileIntake({
            sessionId: activeSession.sessionId,
            locale,
            targetLanguage,
            resumeText: trimmedResume || undefined,
            answers: trimmedManual ? [{ questionId: 'manual_profile', answer: trimmedManual }] : [],
          })

      setSession(response.session)
      setProfile(response.profile)
      setEvidenceItems(response.evidenceItems)
      setQuestions(response.nextQuestions)
      setMaterialSet(null)
      setExportState(null)
      setStatus('editing')
      setCurrentStep('job')
    } catch (caught) {
      setStatus('failed')
      setError(normalizeError(caught, '职业档案创建失败'))
    }
  }

  async function confirmAllEvidence() {
    if (!profile || !session) return
    const ids = evidenceItems.filter((item) => item.needsUserConfirmation).map((item) => item.evidenceId)
    if (ids.length === 0) {
      setCurrentStep('job')
      return
    }

    setError(null)
    setStatus('analyzing')
    try {
      const response = await api.confirmProfile(profile.profileId, {
        sessionId: session.sessionId,
        confirmedEvidenceIds: ids,
      })
      setSession(response.session)
      setProfile(response.profile)
      setEvidenceItems(response.evidenceItems)
      setStatus('editing')
    } catch (caught) {
      setStatus('failed')
      setError(normalizeError(caught, '证据确认失败'))
    }
  }

  async function submitJobMatch() {
    if (!session || !profile) {
      setError({ title: '请先创建职业档案', details: '岗位匹配依赖职业档案中的证据。' })
      setCurrentStep('profile')
      return
    }

    if (jobDescription.trim().length < 40) {
      setError({ title: 'JD 内容太短', details: '请粘贴包含岗位职责、要求或技能关键词的完整 JD。' })
      return
    }

    setError(null)
    setStatus('analyzing')
    try {
      const response = await api.matchJob({
        sessionId: session.sessionId,
        profileId: profile.profileId,
        locale,
        targetLanguage,
        companyName: companyName.trim() || undefined,
        jobTitle: jobTitle.trim() || undefined,
        jobDescription,
      })
      setSession(response.session)
      setJobMatch(response)
      setQuestions((previous) => mergeQuestions(previous, response.followUpQuestions))
      setMaterialSet(null)
      setExportState(null)
      setStatus(response.followUpQuestions.some((question) => question.priority === 'high') ? 'needs_evidence' : 'ready_to_generate')
      setCurrentStep('match')
    } catch (caught) {
      setStatus('failed')
      setError(normalizeError(caught, '岗位匹配失败'))
    }
  }

  async function submitQuestionAnswers() {
    if (!session || !profile) return

    const answers = openQuestions
      .map((question) => ({
        questionId: question.questionId,
        answer: (questionAnswers[question.questionId] ?? '').trim(),
        status: (questionAnswers[question.questionId] ?? '').trim() ? 'answered' as const : 'skipped' as const,
      }))

    if (answers.length === 0) {
      setCurrentStep('resume')
      return
    }

    if (answers.every((answer) => answer.status === 'skipped') && highPriorityQuestions.length > 0) {
      setError({
        title: '高优先级追问还没有证据',
        details: '你可以跳过，但对应岗位要求会继续被阻断，不能写进导出结果。',
      })
    }

    setStatus('analyzing')
    try {
      const response = await api.answerQuestions(profile.profileId, {
        sessionId: session.sessionId,
        answers,
      })
      setSession(response.session)
      setProfile(response.profile)
      setEvidenceItems(response.evidenceItems)
      setQuestions(response.openQuestions)
      if (jobMatch) {
        const rematch = await api.rematchJob(jobMatch.jobId, {
          sessionId: session.sessionId,
          profileId: profile.profileId,
        })
        setJobMatch(rematch)
        setQuestions((previous) => mergeQuestions(previous, rematch.followUpQuestions))
      }
      setQuestionAnswers({})
      setStatus('ready_to_generate')
      setCurrentStep('resume')
    } catch (caught) {
      setStatus('failed')
      setError(normalizeError(caught, '追问提交失败'))
    }
  }

  async function generateMaterialSet() {
    if (!session || !profile || !jobMatch) {
      setError({ title: '缺少生成条件', details: '请先完成职业档案和目标 JD 匹配。' })
      return
    }

    setError(null)
    setStatus('generating')
    try {
      const response = await api.createMaterialSet({
        sessionId: session.sessionId,
        profileId: profile.profileId,
        jobId: jobMatch.jobId,
        targetLanguage,
        direction,
        maxBullets,
      })
      setMaterialSet(response.materialSet)
      setConfirmedBulletIds([])
      setExportState(null)
      setStatus('generated')
      setCurrentStep('review')
    } catch (caught) {
      setStatus('failed')
      setError(normalizeError(caught, '材料生成失败'))
    }
  }

  async function exportMaterial(format: ExportFormat) {
    if (!session || !materialSet) return

    if (exportableBullets.length === 0) {
      setError({
        title: '导出被阻断',
        details: '当前没有可导出的 bullet。请确认需要确认的内容，或回答追问补充证据。',
      })
      return
    }

    setError(null)
    setStatus('generating')
    try {
      const response = await api.exportMaterial({
        sessionId: session.sessionId,
        materialSetId: materialSet.materialSetId,
        format,
        confirmedBulletIds,
      })
      setExportState({
        format,
        content: response.content,
        fileName: response.fileName,
        contentType: response.contentType,
        contentBase64: response.contentBase64,
        excludedCount: response.export.excludedBullets.length,
      })
      setStatus('generated')
      setCurrentStep('export')
    } catch (caught) {
      setStatus('failed')
      setError(normalizeError(caught, '导出失败'))
    }
  }

  function toggleConfirmedBullet(bulletId: string) {
    setConfirmedBulletIds((previous) => {
      if (previous.includes(bulletId)) return previous.filter((id) => id !== bulletId)
      return [...previous, bulletId]
    })
  }

  function downloadExport() {
    if (!exportState?.fileName) return

    if (exportState.contentBase64) {
      const binary = window.atob(exportState.contentBase64)
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
      downloadBlob(new Blob([bytes], { type: exportState.contentType }), exportState.fileName)
      return
    }

    if (exportState.content) {
      downloadBlob(new Blob([exportState.content], { type: exportState.contentType }), exportState.fileName)
    }
  }

  async function copyExport() {
    if (!exportState?.content) return
    await navigator.clipboard.writeText(exportState.content)
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="产品导航">
        <div className="brand-lockup">
          <PineappleLogo />
          <div>
            <p className="eyebrow">AI CV Studio</p>
            <strong>Evidence-first resumes</strong>
          </div>
        </div>

        <nav className="nav-list" aria-label="V1 流程">
          {steps.map((step, index) => {
            const isActive = step.id === currentStep
            const isDone = index < currentStepIndex
            return (
              <button
                className={isActive ? 'active' : isDone ? 'done' : ''}
                key={step.id}
                onClick={() => setCurrentStep(step.id)}
                type="button"
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                {step.label}
              </button>
            )
          })}
        </nav>

        <div className="sidebar-card">
          <p>产品原则</p>
          <strong>没有证据，不写进简历。</strong>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="status-pill">
            <span className={health?.ok ? 'online' : 'offline'}></span>
            后端 {health?.ok ? `在线 v${health.version}` : '检查中'} · {statusText[status]}
          </div>
          <div className="switch-group" aria-label="语言设置">
            <button className={locale === 'zh' ? 'selected' : ''} onClick={() => setLocale('zh')} type="button">
              中文界面
            </button>
            <button className={targetLanguage === 'zh' ? 'selected' : ''} onClick={() => setTargetLanguage('zh')} type="button">
              生成中文
            </button>
            <button className={targetLanguage === 'en' ? 'selected' : ''} onClick={() => setTargetLanguage('en')} type="button">
              Generate EN
            </button>
          </div>
        </header>

        {error && (
          <section className="notice error" role="alert">
            <strong>{error.title}</strong>
            <p>{error.details}</p>
          </section>
        )}

        <section className="flow-layout">
          <article className="primary-panel">
            {currentStep === 'start' && (
              <StartStep health={health} onStart={startFlow} />
            )}

            {currentStep === 'profile' && (
              <ProfileStep
                completedEvidenceCount={completedEvidenceCount}
                evidenceItems={evidenceItems}
                fileInputRef={fileInputRef}
                fileName={fileName}
                manualAnswer={manualAnswer}
                onConfirmAllEvidence={confirmAllEvidence}
                onFile={handleFile}
                onManualAnswerChange={setManualAnswer}
                onResumeTextChange={setResumeText}
                onSubmit={submitProfile}
                profile={profile}
                resumeText={resumeText}
                status={status}
              />
            )}

            {currentStep === 'job' && (
              <JobStep
                companyName={companyName}
                jobDescription={jobDescription}
                jobTitle={jobTitle}
                onCompanyNameChange={setCompanyName}
                onJobDescriptionChange={setJobDescription}
                onJobTitleChange={setJobTitle}
                onSubmit={submitJobMatch}
                profile={profile}
                status={status}
              />
            )}

            {currentStep === 'match' && (
              <MatchStep jobMatch={jobMatch} onContinue={() => setCurrentStep(openQuestions.length ? 'questions' : 'resume')} />
            )}

            {currentStep === 'questions' && (
              <QuestionsStep
                answers={questionAnswers}
                onAnswerChange={(questionId, answer) => setQuestionAnswers((previous) => ({ ...previous, [questionId]: answer }))}
                onSubmit={submitQuestionAnswers}
                questions={openQuestions}
                status={status}
              />
            )}

            {currentStep === 'resume' && (
              <ResumeStep
                direction={direction}
                maxBullets={maxBullets}
                onDirectionChange={setDirection}
                onGenerate={generateMaterialSet}
                onMaxBulletsChange={setMaxBullets}
                status={status}
              />
            )}

            {currentStep === 'review' && (
              <ReviewStep
                blockedBullets={blockedBullets}
                confirmedBulletIds={confirmedBulletIds}
                materialSet={materialSet}
                needsConfirmationBullets={needsConfirmationBullets}
                onConfirmBullet={toggleConfirmedBullet}
                onExport={() => setCurrentStep('export')}
              />
            )}

            {currentStep === 'export' && (
              <ExportStep
                blockedBullets={blockedBullets}
                exportState={exportState}
                exportableBullets={exportableBullets}
                materialSet={materialSet}
                needsConfirmationBullets={needsConfirmationBullets}
                onCopy={copyExport}
                onDownload={downloadExport}
                onExport={exportMaterial}
              />
            )}
          </article>

          <aside className="result-panel" aria-label="流程状态">
            <StatusPanel
              blockedBullets={blockedBullets.length}
              evidenceItems={evidenceItems}
              exportableBullets={exportableBullets.length}
              jobMatch={jobMatch}
              materialSet={materialSet}
              openQuestions={openQuestions.length}
              profile={profile}
              session={session}
            />
          </aside>
        </section>
      </section>

      <nav className="mobile-step-nav" aria-label="移动端流程导航">
        {steps.slice(1).map((step) => (
          <button
            className={currentStep === step.id ? 'active' : ''}
            key={step.id}
            onClick={() => setCurrentStep(step.id)}
            type="button"
          >
            {step.short}
          </button>
        ))}
      </nav>
    </main>
  )
}

function StartStep({ health, onStart }: { health: HealthResponse | null; onStart: () => void }) {
  return (
    <section className="step-card hero-step">
      <p className="section-label">V1 求职材料流程</p>
      <h1>基于真实经历，生成可追溯的岗位版简历。</h1>
      <p className="hero-subtitle">
        这版先完成核心闭环：导入经历、粘贴目标 JD、匹配证据缺口、回答 AI 追问、生成简历 bullet，并在导出前阻断没有证据的内容。
      </p>
      <div className="privacy-box">
        <strong>开始前请确认</strong>
        <p>上传文件和输入文本会发送到本地后端解析。当前后端使用会话内存储，AI key 不会出现在前端源码、浏览器 storage 或网络响应中。</p>
      </div>
      <div className="action-row">
        <button className="primary-action" disabled={!health?.ok} onClick={onStart} type="button">
          开始创建会话
        </button>
        <span className="inline-hint">{health?.ok ? '后端已连接，可以继续。' : '等待后端健康检查。'}</span>
      </div>
    </section>
  )
}

function ProfileStep({
  completedEvidenceCount,
  evidenceItems,
  fileInputRef,
  fileName,
  manualAnswer,
  onConfirmAllEvidence,
  onFile,
  onManualAnswerChange,
  onResumeTextChange,
  onSubmit,
  profile,
  resumeText,
  status,
}: {
  completedEvidenceCount: number
  evidenceItems: EvidenceItem[]
  fileInputRef: React.RefObject<HTMLInputElement | null>
  fileName?: string
  manualAnswer: string
  onConfirmAllEvidence: () => void
  onFile: (file: File) => void
  onManualAnswerChange: (value: string) => void
  onResumeTextChange: (value: string) => void
  onSubmit: () => void
  profile: Profile | null
  resumeText: string
  status: AsyncStatus
}) {
  return (
    <section className="step-card">
      <StepHeader kicker="Step 2" title="导入经历并确认职业档案" description="支持粘贴旧简历、手动补充经历，或上传 txt/md 文件。PDF/DOCX 先复制正文粘贴继续，避免前端不可靠解析。" />
      <div className="form-grid">
        <label className="field-block wide">
          <span>简历或经历文本</span>
          <textarea value={resumeText} onChange={(event) => onResumeTextChange(event.target.value)} />
        </label>
        <label className="field-block wide">
          <span>从零补充一段经历</span>
          <textarea
            placeholder="例如：主导接口稳定性项目，与前端和数据团队协作上线监控告警。"
            value={manualAnswer}
            onChange={(event) => onManualAnswerChange(event.target.value)}
          />
        </label>
      </div>
      <div className="button-row">
        <input
          accept=".txt,.md,.pdf,.docx,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void onFile(file)
          }}
          ref={fileInputRef}
          type="file"
        />
        <button className="ghost-action" onClick={() => fileInputRef.current?.click()} type="button">
          选择文件
        </button>
        <button className="primary-action" disabled={status === 'uploading' || status === 'analyzing'} onClick={onSubmit} type="button">
          {status === 'uploading' || status === 'analyzing' ? '正在解析' : '生成职业档案'}
        </button>
        {fileName && <span className="inline-hint">已选择：{fileName}</span>}
      </div>

      {profile && (
        <section className="sub-panel">
          <div className="metric-row">
            <Metric label="档案完成度" value={`${profile.completeness}%`} />
            <Metric label="证据数量" value={`${evidenceItems.length}`} />
            <Metric label="已确认" value={`${completedEvidenceCount}`} />
          </div>
          <EvidenceList evidenceItems={evidenceItems} />
          {evidenceItems.some((item) => item.needsUserConfirmation) && (
            <button className="ghost-action" onClick={onConfirmAllEvidence} type="button">
              确认当前解析证据
            </button>
          )}
        </section>
      )}
    </section>
  )
}

function JobStep({
  companyName,
  jobDescription,
  jobTitle,
  onCompanyNameChange,
  onJobDescriptionChange,
  onJobTitleChange,
  onSubmit,
  profile,
  status,
}: {
  companyName: string
  jobDescription: string
  jobTitle: string
  onCompanyNameChange: (value: string) => void
  onJobDescriptionChange: (value: string) => void
  onJobTitleChange: (value: string) => void
  onSubmit: () => void
  profile: Profile | null
  status: AsyncStatus
}) {
  return (
    <section className="step-card">
      <StepHeader kicker="Step 4" title="粘贴目标岗位 JD" description="岗位 JD 会被拆成要求、关键词和缺口。JD 只能证明岗位要求，不能证明你具备该能力。" />
      {!profile && <p className="blocker">请先完成职业档案，岗位匹配依赖用户证据。</p>}
      <div className="form-grid">
        <label className="field-block">
          <span>公司名</span>
          <input value={companyName} onChange={(event) => onCompanyNameChange(event.target.value)} />
        </label>
        <label className="field-block">
          <span>职位名</span>
          <input value={jobTitle} onChange={(event) => onJobTitleChange(event.target.value)} />
        </label>
        <label className="field-block wide">
          <span>岗位 JD</span>
          <textarea value={jobDescription} onChange={(event) => onJobDescriptionChange(event.target.value)} />
        </label>
      </div>
      <div className="button-row">
        <button className="primary-action" disabled={!profile || status === 'analyzing'} onClick={onSubmit} type="button">
          {status === 'analyzing' ? '正在匹配' : '分析岗位匹配'}
        </button>
        <span className="inline-hint">至少 40 个字符，包含职责、要求或技能关键词。</span>
      </div>
    </section>
  )
}

function MatchStep({ jobMatch, onContinue }: { jobMatch: JobMatchResponse | null; onContinue: () => void }) {
  if (!jobMatch) {
    return <EmptyStep title="还没有岗位匹配结果" description="请先粘贴目标 JD 并运行匹配。" />
  }

  return (
    <section className="step-card">
      <StepHeader kicker="Step 5" title="查看匹配与缺口" description="这里展示的是岗位要求与用户证据的关系，不是 ATS 通过率承诺。" />
      <div className="metric-row">
        <Metric label="匹配分" value={`${jobMatch.matchScore}`} />
        <Metric label="关键词覆盖" value={`${jobMatch.keywordCoverage}%`} />
        <Metric label="追问数" value={`${jobMatch.followUpQuestions.length}`} />
      </div>
      <div className="split-list">
        <InfoList title="匹配优势" items={jobMatch.strengths} empty="暂无强匹配证据。" />
        <InfoList title="证据缺口" items={jobMatch.gaps} empty="暂未发现明显缺口。" />
      </div>
      <section className="requirement-list">
        {jobMatch.requirements.map((requirement) => {
          const match = jobMatch.matches.find((item) => item.requirementId === requirement.requirementId)
          return (
            <article className="requirement-item" key={requirement.requirementId}>
              <div>
                <span className={`tag ${requirement.priority}`}>{requirement.priority === 'high' ? '高优先级' : '中优先级'}</span>
                <strong>{requirement.text}</strong>
              </div>
              <p>{match?.evidenceIds.length ? `匹配到 ${match.evidenceIds.length} 条证据` : match?.gapReason ?? '缺少用户证据'}</p>
            </article>
          )
        })}
      </section>
      <button className="primary-action" onClick={onContinue} type="button">
        {jobMatch.followUpQuestions.length ? '处理 AI 追问' : '继续生成简历'}
      </button>
    </section>
  )
}

function QuestionsStep({
  answers,
  onAnswerChange,
  onSubmit,
  questions,
  status,
}: {
  answers: Record<string, string>
  onAnswerChange: (questionId: string, answer: string) => void
  onSubmit: () => void
  questions: FollowUpQuestion[]
  status: AsyncStatus
}) {
  if (questions.length === 0) {
    return <EmptyStep title="当前没有待处理追问" description="可以继续生成岗位版简历内容。" />
  }

  return (
    <section className="step-card">
      <StepHeader kicker="Step 6" title="回答 AI 追问" description="追问用于补齐证据。可以跳过，但跳过后相关内容不能作为已支持事实导出。" />
      <div className="question-stack">
        {questions.map((question) => (
          <article className="question-card" key={question.questionId}>
            <span className={`tag ${question.priority}`}>{question.priority === 'high' ? '高优先级' : '中优先级'}</span>
            <h3>{question.question}</h3>
            <p>{question.reason}</p>
            <textarea
              placeholder="补充真实经历、你的角色、工具、范围、结果或不确定性。留空则视为跳过。"
              value={answers[question.questionId] ?? ''}
              onChange={(event) => onAnswerChange(question.questionId, event.target.value)}
            />
          </article>
        ))}
      </div>
      <button className="primary-action" disabled={status === 'analyzing'} onClick={onSubmit} type="button">
        {status === 'analyzing' ? '正在更新证据' : '提交追问并更新匹配'}
      </button>
    </section>
  )
}

function ResumeStep({
  direction,
  maxBullets,
  onDirectionChange,
  onGenerate,
  onMaxBulletsChange,
  status,
}: {
  direction: ResumeDirection
  maxBullets: number
  onDirectionChange: (value: ResumeDirection) => void
  onGenerate: () => void
  onMaxBulletsChange: (value: number) => void
  status: AsyncStatus
}) {
  return (
    <section className="step-card">
      <StepHeader kicker="Step 7" title="生成岗位版简历内容" description="V1 只生成 Summary、Experience bullets、Project bullets 和 Skills line，不生成求职信或自动投递材料。" />
      <div className="option-grid">
        {directionOptions.map((option) => (
          <button
            className={direction === option.value ? 'option-card selected' : 'option-card'}
            key={option.value}
            onClick={() => onDirectionChange(option.value)}
            type="button"
          >
            <strong>{option.label}</strong>
            <span>{option.description}</span>
          </button>
        ))}
      </div>
      <label className="field-block narrow">
        <span>最多生成 bullet 数</span>
        <input min={1} max={12} type="number" value={maxBullets} onChange={(event) => onMaxBulletsChange(Number(event.target.value))} />
      </label>
      <button className="primary-action" disabled={status === 'generating'} onClick={onGenerate} type="button">
        {status === 'generating' ? '正在生成' : '生成简历 bullet'}
      </button>
    </section>
  )
}

function ReviewStep({
  blockedBullets,
  confirmedBulletIds,
  materialSet,
  needsConfirmationBullets,
  onConfirmBullet,
  onExport,
}: {
  blockedBullets: GeneratedBullet[]
  confirmedBulletIds: string[]
  materialSet: MaterialSet | null
  needsConfirmationBullets: GeneratedBullet[]
  onConfirmBullet: (bulletId: string) => void
  onExport: () => void
}) {
  if (!materialSet) {
    return <EmptyStep title="还没有生成结果" description="请先生成岗位版简历 bullet。" />
  }

  return (
    <section className="step-card">
      <StepHeader kicker="Step 8" title="审查来源与风险" description="导出前必须确认来源。blocked 和 needs_evidence 不会进入导出。" />
      <TraceabilityBar materialSet={materialSet} />
      <div className="bullet-stack">
        {materialSet.bullets.map((bullet) => (
          <BulletCard
            bullet={bullet}
            confirmed={confirmedBulletIds.includes(bullet.bulletId)}
            key={bullet.bulletId}
            onConfirm={onConfirmBullet}
          />
        ))}
      </div>
      <div className="notice">
        <strong>导出规则</strong>
        <p>
          当前 {blockedBullets.length} 条内容因证据不足或已阻断不能导出；
          {needsConfirmationBullets.length} 条内容需要你手动确认后才能进入导出。
        </p>
      </div>
      <button className="primary-action" onClick={onExport} type="button">
        进入复制或导出
      </button>
    </section>
  )
}

function ExportStep({
  blockedBullets,
  exportState,
  exportableBullets,
  materialSet,
  needsConfirmationBullets,
  onCopy,
  onDownload,
  onExport,
}: {
  blockedBullets: GeneratedBullet[]
  exportState: ExportState | null
  exportableBullets: GeneratedBullet[]
  materialSet: MaterialSet | null
  needsConfirmationBullets: GeneratedBullet[]
  onCopy: () => void
  onDownload: () => void
  onExport: (format: ExportFormat) => void
}) {
  return (
    <section className="step-card">
      <StepHeader kicker="Step 9" title="复制或导出" description="导出请求会再次由后端校验，无法导出没有来源或证据不足的内容。" />
      {!materialSet && <p className="blocker">还没有可导出的材料。</p>}
      {materialSet && (
        <>
          <div className="metric-row">
            <Metric label="可导出" value={`${exportableBullets.length}`} />
            <Metric label="需确认" value={`${needsConfirmationBullets.length}`} />
            <Metric label="已阻断" value={`${blockedBullets.length}`} />
          </div>
          <div className="button-row">
            <button className="primary-action" onClick={() => onExport('markdown')} type="button">生成 Markdown</button>
            <button className="ghost-action" onClick={() => onExport('plain_text')} type="button">生成纯文本</button>
            <button className="ghost-action" onClick={() => onExport('pdf')} type="button">生成 PDF</button>
          </div>
        </>
      )}
      {exportState && (
        <section className="export-preview">
          <div className="panel-heading wide">
            <div>
              <p className="section-label">导出结果</p>
              <h2>{exportState.fileName}</h2>
            </div>
            <div className="button-row">
              {exportState.content && <button className="ghost-action" onClick={onCopy} type="button">复制</button>}
              <button className="primary-action" onClick={onDownload} type="button">下载</button>
            </div>
          </div>
          {exportState.excludedCount ? <p className="inline-hint">后端已排除 {exportState.excludedCount} 条不可导出内容。</p> : null}
          {exportState.content && <pre>{exportState.content}</pre>}
          {exportState.contentBase64 && <p>PDF 已生成，可以下载查看。</p>}
        </section>
      )}
    </section>
  )
}

function StatusPanel({
  blockedBullets,
  evidenceItems,
  exportableBullets,
  jobMatch,
  materialSet,
  openQuestions,
  profile,
  session,
}: {
  blockedBullets: number
  evidenceItems: EvidenceItem[]
  exportableBullets: number
  jobMatch: JobMatchResponse | null
  materialSet: MaterialSet | null
  openQuestions: number
  profile: Profile | null
  session: SessionSummary | null
}) {
  return (
    <div className="status-panel-content">
      <p className="section-label">实时状态</p>
      <h2>{materialSet?.title ?? 'V1 traceable resume flow'}</h2>
      <div className="metric-grid">
        <Metric label="Session" value={session ? session.sessionId.replace('session_', '#') : '未创建'} />
        <Metric label="档案" value={profile ? `${profile.completeness}%` : '未完成'} />
        <Metric label="证据" value={`${evidenceItems.length}`} />
        <Metric label="追问" value={`${openQuestions}`} />
      </div>
      {jobMatch && (
        <section className="side-section">
          <strong>岗位匹配</strong>
          <p>匹配分 {jobMatch.matchScore}，关键词覆盖 {jobMatch.keywordCoverage}%。</p>
          <InfoList title="ATS 提醒" items={jobMatch.atsWarnings} empty="暂无 ATS 风险提示。" />
        </section>
      )}
      {materialSet && (
        <section className="side-section">
          <strong>来源追踪</strong>
          <p>
            {materialSet.traceability.profileClaims} 条档案 claim，
            {materialSet.traceability.jobDescriptionReferences} 条 JD 引用，
            {materialSet.traceability.unsupportedClaims} 条不支持内容。
          </p>
          <p>可导出 {exportableBullets} 条，阻断 {blockedBullets} 条。</p>
        </section>
      )}
    </div>
  )
}

function StepHeader({ description, kicker, title }: { description: string; kicker: string; title: string }) {
  return (
    <header className="step-header">
      <p className="section-label">{kicker}</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  )
}

function EmptyStep({ description, title }: { description: string; title: string }) {
  return (
    <section className="step-card empty-state">
      <PineappleLogo size={72} muted />
      <h1>{title}</h1>
      <p>{description}</p>
    </section>
  )
}

function EvidenceList({ evidenceItems }: { evidenceItems: EvidenceItem[] }) {
  if (evidenceItems.length === 0) return <p className="inline-hint">还没有证据。</p>

  return (
    <div className="evidence-list">
      {evidenceItems.slice(0, 8).map((item) => (
        <article className="evidence-item" key={item.evidenceId}>
          <div>
            <span className="tag">{item.evidenceType}</span>
            {item.needsUserConfirmation && <span className="tag warn">需要确认</span>}
          </div>
          <p>{item.text}</p>
          {item.skills.length > 0 && <small>{item.skills.slice(0, 6).join(' · ')}</small>}
        </article>
      ))}
    </div>
  )
}

function BulletCard({
  bullet,
  confirmed,
  onConfirm,
}: {
  bullet: GeneratedBullet
  confirmed: boolean
  onConfirm: (bulletId: string) => void
}) {
  const canConfirm = bullet.status === 'needs_confirmation'
  return (
    <article className={`bullet-card ${bullet.status}`}>
      <div className="bullet-head">
        <span className={`tag ${bullet.status}`}>{bulletStatusText[bullet.status]}</span>
        {canConfirm && (
          <label className="confirm-check">
            <input checked={confirmed} onChange={() => onConfirm(bullet.bulletId)} type="checkbox" />
            我确认这条事实可用
          </label>
        )}
      </div>
      <p>{bullet.text}</p>
      <small>{bullet.reviewNote}</small>
      <details>
        <summary>查看来源</summary>
        {bullet.claims.map((claim) => (
          <div className="source-trace" key={claim.claimId}>
            <strong>{claim.claimText}</strong>
            {claim.sourceRefs.map((source) => (
              <blockquote key={source.sourceRefId}>{source.quote}</blockquote>
            ))}
          </div>
        ))}
      </details>
    </article>
  )
}

function TraceabilityBar({ materialSet }: { materialSet: MaterialSet }) {
  return (
    <div className="traceability-bar">
      <Metric label="档案 Claim" value={`${materialSet.traceability.profileClaims}`} />
      <Metric label="JD 引用" value={`${materialSet.traceability.jobDescriptionReferences}`} />
      <Metric label="不支持 Claim" value={`${materialSet.traceability.unsupportedClaims}`} />
      <Metric label="模型" value={materialSet.modelName} />
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function InfoList({ empty, items, title }: { empty: string; items: string[]; title: string }) {
  return (
    <section className="info-list">
      <strong>{title}</strong>
      {items.length ? (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>{empty}</p>
      )}
    </section>
  )
}

function PineappleLogo({ muted = false, size = 44 }: { muted?: boolean; size?: number }) {
  return (
    <svg
      aria-label="AI CV Studio"
      className={muted ? 'pineapple-logo muted' : 'pineapple-logo'}
      height={size}
      viewBox="0 0 64 64"
      width={size}
    >
      <path className="leaf" d="M31 19 L22 9 L29 12 Z" />
      <path className="leaf" d="M33 20 L34 6 L39 16 Z" />
      <path className="leaf" d="M36 20 L48 11 L43 22 Z" />
      <path className="body" d="M32 18 C42 20 50 31 47 43 C44 55 36 59 27 56 C18 53 14 43 17 32 C19 24 24 19 32 18 Z" />
      <path className="grid" d="M20 31 L40 55 M17 39 L30 56 M27 20 L47 42 M38 23 L18 43 M45 32 L25 56" />
      <circle className="node" cx="31" cy="38" r="1.8" />
      <circle className="node" cx="37" cy="45" r="1.8" />
    </svg>
  )
}

function mergeQuestions(existing: FollowUpQuestion[], incoming: FollowUpQuestion[]) {
  const byId = new Map(existing.map((question) => [question.questionId, question]))
  for (const question of incoming) {
    byId.set(question.questionId, question)
  }
  return Array.from(byId.values())
}

function normalizeError(caught: unknown, fallbackTitle: string): AppError {
  if (caught instanceof ApiClientError) {
    return {
      title: caught.message || fallbackTitle,
      details: caught.details,
    }
  }

  if (caught instanceof Error) {
    return {
      title: fallbackTitle,
      details: caught.message,
    }
  }

  return {
    title: fallbackTitle,
    details: '发生未知错误，请重试。',
  }
}

function mimeFromFileName(name: string) {
  const extension = name.split('.').pop()?.toLowerCase() ?? ''
  return fileMimeFallback[extension]
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

export default App
