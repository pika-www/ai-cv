# 仓库规则

每次提交前都必须遵守这些规则。

## 不要提交

- `node_modules/`
- `dist/`
- `.env`
- `.env.local`
- API key
- 本地编辑器配置
- 系统文件，例如 `.DS_Store`
- 生成的日志文件
- 临时截图，除非明确要作为文档素材

## 应该提交

- 源代码
- 应用需要的 public 静态资源
- `package.json`
- `package-lock.json`
- TypeScript 和 Vite 配置
- `docs/` 下的文档

## 必跑检查

推送前端改动前运行：

```bash
npm run lint
npm run build
git status --short
```

`git status --short` 不能出现依赖目录或构建产物。

## 分支和提交建议

- 每个 commit 只处理一个清晰的产品变化。
- commit message 要明确，例如 `Add profile intake form`。
- 不要把无关重构和功能开发混在一个 commit 里。
- 除非产品 owner 明确要求，不要 force-push 共享分支。

## 命名规范

参考 [ruanyf/document-style-guide](https://github.com/ruanyf/document-style-guide)：

- Markdown 文件名只用小写字母、数字和连字符。
- 文件名不能有空格，不能使用中文或全角字符。
- `README`、`LICENSE` 这类说明文件可以保留大写。
- 多个单词时优先使用 `kebab-case`，例如 `product-v1-scope.md`。
- 标题层级要简洁，不要出现孤立编号。
- 中文正文使用全角标点，英文正文使用半角标点。

## 环境变量建议

运行时密钥必须放在本地环境文件或部署平台配置里，不能提交到 Git。

未来可能需要的变量示例：

```bash
VITE_API_BASE_URL=http://localhost:4000
```
