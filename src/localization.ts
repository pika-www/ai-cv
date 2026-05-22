const backendTextMap = new Map<string, string>([
  ['No structured resume lines were detected. Paste more complete resume text if the preview looks empty.', '没有识别到结构化简历内容。如果预览为空，请粘贴更完整的简历正文。'],
  ['Some extracted facts need user confirmation before export.', '部分提取出的事实需要你确认后再导出。'],
  ['The new content describes responsibilities or work impact.', '这段新增内容更适合放在工作经历，因为它描述了职责或工作影响。'],
  ['The new content describes a project delivery or launch.', '这段新增内容更适合放在项目经历，因为它描述了项目交付或上线结果。'],
  ['The new content is mainly a skill or tool list.', '这段新增内容更像技能或工具清单，适合放在技能区。'],
  ['The new content describes education background.', '这段新增内容更适合放在教育经历。'],
  ['The new content reads like a profile summary.', '这段新增内容更像个人总结。'],
  ['The backend could not confidently map this to a core resume section.', '系统暂时无法明确判断这段内容应该放在哪个核心简历区块，请你确认位置。'],
  ['The new experience contains estimated wording and needs confirmation.', '新增经历里包含估算表达，需要你确认后再导出。'],
  ['No metric was detected. Keep the inserted text factual unless you add a confirmed result.', '没有识别到明确指标。除非你补充已确认结果，否则请保持表述真实克制。'],
  ['Inserted text is based only on the provided newExperience.', '插入内容只基于你刚刚提供的新增经历。'],
  ['This line is long and hard to scan.', '这一行偏长，不利于招聘方快速浏览。'],
  ['This experience lacks a concrete result.', '这段经历缺少明确结果。'],
  ['This line contains estimated wording.', '这一行包含估算式表达。'],
  ['No blocking resume issue detected by the backend checks.', '后端检查没有发现阻断性简历问题。'],
  ['Split it into a concise responsibility plus one measurable outcome.', '建议拆成一句简洁职责和一个可衡量结果。'],
  ['Add a user-confirmed metric, scope, or outcome if you have one.', '如果你有真实依据，请补充已确认的指标、规模或结果。'],
  ['Confirm the number or rewrite it as qualitative impact before export.', '导出前请确认数字，或改写成不含估算数字的定性影响。'],
  ['Review wording for clarity and keep facts evidence-backed.', '继续检查表达清晰度，并确保所有事实都有依据。'],
  ['Keep role keywords explicit for ATS parsing.', '保留明确的岗位关键词，便于 ATS 解析。'],
  ['Prefer shorter wording.', '优先使用更短表达。'],
  ['Lead with the result when the fact is confirmed.', '如果事实已确认，建议把结果放在句首。'],
  ['Access token required', '需要访问口令'],
  ['Invalid input', '输入内容无效'],
  ['Input too large', '输入内容过长'],
  ['Unsupported file type', '不支持的文件类型'],
  ['Profile required', '需要先创建职业档案'],
  ['Profile not found', '没有找到职业档案'],
  ['Session not found', '没有找到当前会话'],
  ['Export blocked', '导出被阻止'],
  ['Invalid export payload', '导出请求无效'],
  ['Invalid draft document', '简历草稿无效'],
  ['PDF export uses preview template', 'PDF 使用前端预览模板导出'],
  ['AI insert unavailable', 'AI 插入暂时不可用'],
  ['AI provider rejected credentials or access. Check the selected AI key.', 'AI provider 拒绝了当前 key 或访问权限，请检查模型 key。'],
  ['AI provider rate limited this insert request.', 'AI provider 对这次新增经历插入请求限流了，请稍后重试。'],
  ['AI provider insert request timed out. Please retry.', 'AI provider 新增经历插入请求超时，请稍后重试。'],
  ['AI provider configuration is invalid.', 'AI provider 配置无效，请检查 base URL、协议类型和模型名称。'],
  ['AI provider rejected the insert request.', 'AI provider 拒绝了这次新增经历插入请求，请检查输入内容。'],
  ['AI provider is temporarily unavailable.', 'AI provider 暂时不可用，请稍后重试。'],
  ['AI provider returned an unusable insert response.', 'AI provider 返回的新增经历结果不可用，请稍后重试。'],
  ['wireApi must be responses or chat_completions.', 'wire API 只能选择 Responses 或 Chat Completions。'],
  ['User session AI key is not configured or has expired. Configure a session AI provider key and retry.', '当前会话没有配置可用的模型 key，或 key 已过期。请重新保存本次会话的模型 key 后重试。'],
  ['Access token is missing or invalid. Configure VITE_APP_ACCESS_TOKEN in the frontend, or send Authorization: Bearer <token> / X-Access-Token with the same value as APP_ACCESS_TOKEN.', '访问口令缺失或无效。请配置前端口令，或输入与后端 APP_ACCESS_TOKEN 一致的朋友试用口令。'],
  ['Supported file types are .txt, .md, .pdf, and .docx. You can also paste resume text directly.', '支持 .txt、.md、.pdf 和 .docx。你也可以直接粘贴简历正文。'],
  ['Unsupported mimeType. Paste resume text directly if parsing fails.', '不支持这个文件类型标记。如果解析失败，请直接粘贴简历正文。'],
  ['Create or parse a profile before matching jobs or generating materials.', '请先创建或解析职业档案，再匹配职位或生成求职材料。'],
  ['Unknown profileId.', '没有找到这个职业档案 ID。'],
  ['Unknown sessionId.', '没有找到这个会话 ID。'],
  ['Provide materialSetId or draftDocument.', '请提供材料集 ID 或简历草稿。'],
  ['No exportable bullets. Confirm evidence-backed bullets or answer follow-up questions first.', '当前没有可导出的条目。请先确认有依据的要点，或回答补充问题。'],
  ['Confirm or edit AI-inserted changes before exporting this draft.', '导出前请先确认或编辑 AI 插入的改动。'],
  ['sessionId must match draftDocument.sessionId.', '会话 ID 必须与简历草稿中的会话 ID 一致。'],
  ['PDF is generated from the frontend ResumePreview HTML/CSS print flow. The backend no longer returns a separately rendered PDF because that would create a second template source.', 'PDF 已改为使用前端预览模板生成，后端不再返回另一套 PDF 模板，避免预览和导出不一致。'],
  ['Model capability unavailable', '模型能力不可用'],
  ['当前模型尚未完成能力检测，请先运行模型能力检测。', '当前模型尚未完成能力检测，请先运行模型能力检测。'],
  ['当前模型无法用于简历分析，请更换模型或使用默认模型。', '当前模型无法用于简历分析，请更换模型或使用默认模型。'],
  ['AI provider 拒绝了当前 key 或模型权限。', 'AI provider 拒绝了当前 key 或模型权限。'],
  ['AI provider 当前限流，请稍后重试。', 'AI provider 当前限流，请稍后重试。'],
  ['AI provider 能力检测超时，请稍后重试。', 'AI provider 能力检测超时，请稍后重试。'],
  ['AI provider 拒绝了当前能力检测请求。', 'AI provider 拒绝了当前能力检测请求。'],
  ['AI provider 配置无效。', 'AI provider 配置无效。'],
  ['AI provider 暂时不可用或返回内容不可用。', 'AI provider 暂时不可用或返回内容不可用。'],
  ['模型返回了可解析 JSON，但没有返回可用简历建议。', '模型返回了可解析 JSON，但没有返回可用简历建议。'],
  ['模型返回内容无法解析为后端需要的 JSON。', '模型返回内容无法解析为后端需要的 JSON。'],
  ['模型能力检测请求失败，请检查 key、base URL、模型名或稍后重试。', '模型能力检测请求失败，请检查 key、base URL、模型名或稍后重试。'],
  ['当前模型无法返回结构化简历建议。', '当前模型无法返回结构化简历建议。'],
  ['当前模型无法返回结构化 JSON 建议。', '当前模型无法返回结构化 JSON 建议。'],
])

const backendTextPatterns: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
  [/^(.+) must contain at least (\d+) characters\.$/, (match) => `${fieldLabel(match[1])}至少需要 ${match[2]} 个字符。`],
  [/^(.+) must be at most (\d+) characters\. Paste a shorter excerpt or split the resume\.$/, (match) => `${fieldLabel(match[1])}最多支持 ${match[2]} 个字符。请粘贴更短的片段，或拆分简历内容。`],
]

export function localizeBackendText(text: string | null | undefined) {
  const normalized = text?.trim()
  if (!normalized) return ''

  const exact = backendTextMap.get(normalized)
  if (exact) return exact

  for (const [pattern, translate] of backendTextPatterns) {
    const match = normalized.match(pattern)
    if (match) return translate(match)
  }

  return normalized
}

export function localizeBackendTexts(texts: string[]) {
  return texts.map(localizeBackendText)
}

function fieldLabel(field: string) {
  const labels: Record<string, string> = {
    draftDocument: '简历草稿',
    jobDescription: '职位描述',
    newExperience: '新增经历',
    resumeText: '简历正文',
  }
  return labels[field] ?? field
}
