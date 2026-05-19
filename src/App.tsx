import { useMemo, useState } from 'react'
import './App.css'

type Locale = 'zh' | 'en'

type Copy = {
  nav: string[]
  badge: string
  title: string
  subtitle: string
  primaryAction: string
  secondaryAction: string
  trust: string[]
  uploadTitle: string
  uploadBody: string
  uploadButton: string
  blankButton: string
  profileTitle: string
  profileItems: string[]
  jobTitle: string
  jobMeta: string
  jobBullets: string[]
  interviewTitle: string
  interviewPrompt: string
  interviewChips: string[]
  resumeTitle: string
  resumeTabs: string[]
  resumeName: string
  resumeRole: string
  resumeSummary: string
  resumeBullets: string[]
  coverTitle: string
  coverBody: string
}

const copies: Record<Locale, Copy> = {
  zh: {
    nav: ['工作台', '职业档案', '岗位匹配', '材料包'],
    badge: 'AI Career Kit / 中英双语',
    title: '从真实经历开始，生成可以投递的求职材料。',
    subtitle:
      '上传旧简历或从零问答创建档案。系统会追问项目细节、匹配目标岗位，并生成中英简历、求职信和面试自我介绍。',
    primaryAction: '开始创建档案',
    secondaryAction: '上传旧简历',
    trust: ['可追溯内容', 'ATS 结构检查', '中英同步生成'],
    uploadTitle: '导入已有材料',
    uploadBody: '支持 PDF、DOCX、TXT。解析后会拆成教育、经历、项目和技能，方便 AI 继续追问。',
    uploadButton: '选择文件',
    blankButton: '从零开始',
    profileTitle: '职业档案完成度',
    profileItems: ['基础信息', '教育经历', '工作经历', '项目成果', '技能证据'],
    jobTitle: '目标岗位匹配',
    jobMeta: 'Product Manager / Global SaaS / English JD',
    jobBullets: ['关键词覆盖 74%', '缺少增长实验案例', '建议强化跨团队协作', '英文摘要需要更具体'],
    interviewTitle: 'AI 追问',
    interviewPrompt: '你提到“负责用户增长”。请补充：目标指标是什么？你做了哪 3 个动作？最终数据变化是多少？',
    interviewChips: ['补充数据', '解释我的职责', '没有明确指标', '换成英文问'],
    resumeTitle: '材料预览',
    resumeTabs: ['中文简历', 'English Resume', 'Cover Letter'],
    resumeName: '林夏',
    resumeRole: '增长产品经理 / Growth Product Manager',
    resumeSummary:
      '5 年 B2B SaaS 增长与产品经验，擅长从用户行为数据中识别转化瓶颈，并推动跨团队实验落地。',
    resumeBullets: [
      '设计并上线新用户激活流程，将首周关键功能使用率从 38% 提升至 56%。',
      '与销售、数据和工程团队建立漏斗复盘机制，缩短企业线索响应时间 42%。',
      '基于 12,000+ 用户事件数据重构定价页信息架构，带来 18% 试用转化提升。',
    ],
    coverTitle: '求职信草稿',
    coverBody:
      '这封信会引用岗位 JD 中的真实要求，并只使用职业档案里已经确认过的经历，避免夸大或编造。',
  },
  en: {
    nav: ['Workspace', 'Profile', 'Job Match', 'Career Kit'],
    badge: 'AI Career Kit / Bilingual',
    title: 'Build job-ready materials from verified career evidence.',
    subtitle:
      'Upload an old resume or start with guided questions. The system probes for proof, matches a target role, and drafts bilingual resumes, cover letters, and interview intros.',
    primaryAction: 'Build profile',
    secondaryAction: 'Upload resume',
    trust: ['Evidence-backed', 'ATS structure checks', 'Chinese + English'],
    uploadTitle: 'Import existing materials',
    uploadBody:
      'PDF, DOCX, and TXT will be parsed into education, experience, projects, and skills so the AI can ask smarter follow-ups.',
    uploadButton: 'Choose file',
    blankButton: 'Start blank',
    profileTitle: 'Career profile readiness',
    profileItems: ['Basics', 'Education', 'Experience', 'Project impact', 'Skill evidence'],
    jobTitle: 'Target job match',
    jobMeta: 'Product Manager / Global SaaS / English JD',
    jobBullets: ['Keyword coverage 74%', 'Growth experiment story missing', 'Emphasize cross-functional work', 'English summary needs proof'],
    interviewTitle: 'AI follow-up',
    interviewPrompt:
      'You mentioned “owned user growth.” What was the target metric, what three actions did you take, and how did the number change?',
    interviewChips: ['Add metrics', 'Clarify my role', 'No exact metric', 'Ask in Chinese'],
    resumeTitle: 'Material preview',
    resumeTabs: ['Chinese Resume', 'English Resume', 'Cover Letter'],
    resumeName: 'Lin Xia',
    resumeRole: 'Growth Product Manager',
    resumeSummary:
      'Growth product manager with 5 years in B2B SaaS, focused on conversion diagnosis, activation experiments, and cross-functional execution.',
    resumeBullets: [
      'Launched a new onboarding flow that increased first-week key feature adoption from 38% to 56%.',
      'Built a funnel review cadence with sales, data, and engineering, reducing enterprise lead response time by 42%.',
      'Restructured pricing-page messaging using 12,000+ user events, improving trial conversion by 18%.',
    ],
    coverTitle: 'Cover letter draft',
    coverBody:
      'The letter references real requirements from the JD and only uses confirmed profile evidence, keeping the tone specific without inventing claims.',
  },
}

const progress = [100, 82, 64, 46, 28]

function App() {
  const [locale, setLocale] = useState<Locale>('zh')
  const [activeTab, setActiveTab] = useState(0)
  const t = copies[locale]

  const insight = useMemo(() => {
    return locale === 'zh'
      ? '下一步建议：先补全两个含数字的项目成果，再生成岗位版英文 resume。'
      : 'Next best step: add two metric-backed project outcomes, then draft the job-specific English resume.'
  }, [locale])

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Product navigation">
        <div className="brand-lockup">
          <div className="brand-mark">CC</div>
          <div>
            <p className="eyebrow">CareerCraft</p>
            <strong>AI CV Studio</strong>
          </div>
        </div>

        <nav className="nav-list">
          {t.nav.map((item, index) => (
            <a href={`#section-${index}`} className={index === 0 ? 'active' : ''} key={item}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              {item}
            </a>
          ))}
        </nav>

        <div className="sidebar-card">
          <p>{locale === 'zh' ? '产品原则' : 'Product rule'}</p>
          <strong>{locale === 'zh' ? '没有证据，不写进简历。' : 'No evidence, no resume claim.'}</strong>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="status-pill">
            <span></span>
            {t.badge}
          </div>
          <div className="locale-switch" aria-label="Language switcher">
            <button className={locale === 'zh' ? 'selected' : ''} onClick={() => setLocale('zh')} type="button">
              中文
            </button>
            <button className={locale === 'en' ? 'selected' : ''} onClick={() => setLocale('en')} type="button">
              EN
            </button>
          </div>
        </header>

        <section className="hero-panel" id="section-0">
          <div className="hero-copy">
            <p className="section-label">{locale === 'zh' ? '求职材料工作台' : 'Career material workspace'}</p>
            <h1>{t.title}</h1>
            <p className="hero-subtitle">{t.subtitle}</p>
            <div className="action-row">
              <button className="primary-action" type="button">{t.primaryAction}</button>
              <button className="ghost-action" type="button">{t.secondaryAction}</button>
            </div>
          </div>

          <div className="proof-strip" aria-label="Trust signals">
            {t.trust.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </section>

        <section className="grid-two">
          <article className="panel upload-panel" id="section-1">
            <div className="panel-heading">
              <span className="icon-box">UP</span>
              <div>
                <p className="section-label">{locale === 'zh' ? '入口' : 'Intake'}</p>
                <h2>{t.uploadTitle}</h2>
              </div>
            </div>
            <p>{t.uploadBody}</p>
            <div className="upload-drop">
              <div className="file-stack">
                <span>PDF</span>
                <span>DOCX</span>
                <span>TXT</span>
              </div>
              <strong>{locale === 'zh' ? '拖拽旧简历到这里' : 'Drop an existing resume here'}</strong>
              <small>{locale === 'zh' ? '或继续用问答创建完整档案' : 'or continue with guided profile creation'}</small>
            </div>
            <div className="button-pair">
              <button type="button">{t.uploadButton}</button>
              <button type="button">{t.blankButton}</button>
            </div>
          </article>

          <article className="panel profile-panel">
            <div className="panel-heading">
              <span className="icon-box">ID</span>
              <div>
                <p className="section-label">{locale === 'zh' ? '真实经历库' : 'Evidence profile'}</p>
                <h2>{t.profileTitle}</h2>
              </div>
            </div>
            <div className="readiness">
              {t.profileItems.map((item, index) => (
                <div className="readiness-row" key={item}>
                  <div>
                    <span>{item}</span>
                    <small>{progress[index]}%</small>
                  </div>
                  <meter value={progress[index]} min="0" max="100">
                    {progress[index]}%
                  </meter>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="grid-two">
          <article className="panel job-panel" id="section-2">
            <div className="panel-heading">
              <span className="icon-box">JD</span>
              <div>
                <p className="section-label">ATS + Role Fit</p>
                <h2>{t.jobTitle}</h2>
              </div>
            </div>
            <div className="job-card">
              <div>
                <strong>{t.jobMeta}</strong>
                <span>Match 78</span>
              </div>
              <div className="match-ring" aria-label="Match score">78</div>
            </div>
            <ul className="insight-list">
              {t.jobBullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </article>

          <article className="panel interview-panel">
            <div className="panel-heading">
              <span className="icon-box">AI</span>
              <div>
                <p className="section-label">{locale === 'zh' ? '深挖经历' : 'Experience probe'}</p>
                <h2>{t.interviewTitle}</h2>
              </div>
            </div>
            <div className="chat-card">
              <p>{t.interviewPrompt}</p>
            </div>
            <div className="chip-row">
              {t.interviewChips.map((chip) => (
                <button type="button" key={chip}>{chip}</button>
              ))}
            </div>
            <p className="next-step">{insight}</p>
          </article>
        </section>

        <section className="panel material-panel" id="section-3">
          <div className="panel-heading wide">
            <div>
              <p className="section-label">{locale === 'zh' ? '输出' : 'Output'}</p>
              <h2>{t.resumeTitle}</h2>
            </div>
            <div className="tab-row">
              {t.resumeTabs.map((tab, index) => (
                <button
                  className={activeTab === index ? 'selected' : ''}
                  key={tab}
                  onClick={() => setActiveTab(index)}
                  type="button"
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="material-grid">
            <article className="resume-preview">
              <div className="resume-header">
                <div>
                  <h3>{t.resumeName}</h3>
                  <p>{t.resumeRole}</p>
                </div>
                <span>PDF / DOCX / MD</span>
              </div>
              <p className="resume-summary">{t.resumeSummary}</p>
              <ul>
                {t.resumeBullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </article>

            <aside className="cover-preview">
              <p className="section-label">{t.coverTitle}</p>
              <p>{t.coverBody}</p>
              <div className="source-box">
                <strong>{locale === 'zh' ? '来源追踪' : 'Source trace'}</strong>
                <span>{locale === 'zh' ? '3 条来自职业档案，2 条来自 JD。' : '3 claims from profile, 2 from the JD.'}</span>
              </div>
            </aside>
          </div>
        </section>
      </section>
    </main>
  )
}

export default App
