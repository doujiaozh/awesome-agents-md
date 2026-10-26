# 🛑 Stop AI from Writing Garbage Code

### 全球最强、零依赖的 AI 编程规范模板 —— `AGENTS.md` + 60 秒生成 CLI

**awesome-agents-md** 是一个**不写应用代码**的开源项目。它只交付一样东西：
一份让 Cursor、DeepSeek Harness (DSH)、GitHub Copilot、Claude Code、Codex、Windsurf
见了就乖乖干活的 **AGENTS.md** —— 以及一个零依赖、单文件、把这份契约按你的技术栈定制出来的 CLI。

[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)
[![Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](#)
[![Node](https://img.shields.io/badge/node-%3E%3D18-339933.svg)](https://nodejs.org)
[![Made with spite](https://img.shields.io/badge/made%20with-spite-red.svg)](#)

> **TL;DR** — `git clone` → `node index.js` → 回答 6 个问题 → 你的项目里多出一份 300 行的 AI 劳动法。
> 没有 `npm install`，没有 node_modules，没有构建步骤。零依赖的意思就是字面意义的零。
>
> 如果你只想抄作业：[AGENTS.md](./AGENTS.md) 就是模板本体，改掉 `<fill in>` 直接用。

---

## 0. 这不是又一个 awesome-list

市面上的 `awesome-*` 项目都是**收藏夹**——把链接摆好，然后假装你读了就有用。
本项目的信仰不同：**AI 读清单，是当背景噪音读的；AI 读 `MUST / MUST NOT`，是当代码审计读的。**

所以仓库里没有清单，只有：

| 文件 | 作用 |
|---|---|
| [AGENTS.md](./AGENTS.md) | 契约本体（完全体模板，带 `<fill in>` 占位符，人类可读可改） |
| [index.js](./index.js) | 零依赖生成器（Node 原生 `fs` / `path` / `readline`，单文件，内建 6 语言 × 13 框架的规范知识库） |
| [README.md](./README.md) | 你正在看的这篇 |
| [LICENSE](./LICENSE) | Apache-2.0 |

---

## 1. 🤬 为什么 AI 总是写出烂代码？

不是模型笨。是**你没给它写规矩**。

AI 编程助手的出厂行为是"最短路径讨好你"：能跑就行、能交差就行、然后它就已经在等待下一个任务了。
于是它稳定地输出**六宗罪**:

1. **它不读测试就动手** —— 改坏边界条件，测试一片飘红，然后跟你说 "已完成 ✅"。
2. **它热爱未授权的重构** —— 你让它修个 bug，它顺手把 `utils.js` 拆成 `helpers/new/index.ts`，
   400 行 diff，其中 380 行跟你说的那个 bug 一毛钱关系没有。
3. **它患有多动症式依赖症** —— 两行标准库能写完的事，先 `npm i left-pad` 再说，顺便还给你升了个大版本。
4. **它的提交日志像加密报文** —— `update` · `fix bug` · `asdf` · `wip 2` · `dadada`。
5. **它把秘密写进 Git 历史** —— `.env`、API key 一把梭，`git push` 完全网可见，删除键也救不了你。
6. **它不会说 "我不知道"** —— 编造一个不存在的 API，然后写代码"调用"它，编译器一片红它还要嘴硬。

**根因只有一条：`AGENTS.md` 缺失。** 你没有把"我们团队到底怎么写代码"写成**机器可读的契约**，
AI 只能靠猜。以当前模型的平均水准，它猜错的概率恰好是 100%。

> 你对 AI 的每次妥协，都会在下一次 code review 里连本带利还回来。

---

## 2. ✨ 一份 AGENTS.md，十张军令状

| § | 章节 | 治的病 |
|---|---|---|
| 0 | 契约阅读法 | 规则冲突时**更严的赢**；§6（安全）最高优先级 |
| 1 | 🧱 技术栈声明 | 禁止"顺手"换框架 / 加依赖 / 升版本——都得人类批准 |
| 2 | 📁 目录结构约束 | 禁止 `*-new`、`v2`、`tmp` 式文件夹增生；新顶层目录先问人 |
| 3 | ✍️ 代码风格 | 命名 / 注释 / 函数 / 错误处理 / 格式化五件套（按生态定制） |
| 4 | 🧪 测试先行 | **改代码前必须先读并跑相关测试**；修 bug 先写红测试 |
| 5 | 🗂️ Git 规范 | Conventional Commits；禁止 `--no-verify`；禁止直推 `main` |
| 6 | 🔒 安全红线 | 密钥零容忍 + 危险 API 黑名单（eval / shell=True / 内联 SQL…）+ default-deny |
| 7 | 🤖 工作流协议 | grep → 计划 → 红测试 → 最小 diff → **真跑**测试 → 报告 |
| 8 | 🪦 反模式耻辱柱 | 10 条 AI 的高频犯罪现场，写进了它的耻辱柱 |
| 9 | 🧭 歧义与升级 | 不确定就**问**；编造测试结果 = 最严重的违约 |
| 10 | ✅ 完成清单 | 交付前必须逐条打钩的自检表，打不了钩就明说 |

模板里每条规则按 [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) 语义写。
AI 读到 **"MUST NOT 删测试让它变绿"** 时的服从量级，和读到 "please avoid deleting tests"
完全是两个物种——**模糊的规则等于没有规则**。

---

## 3. ⚡ 60 秒上手

```bash
git clone https://github.com/doujiaozh/awesome-agents-md.git
cd awesome-agents-md
node index.js
```

不需要 `npm install`——**零依赖**，`fs` / `path` / `readline` 全是 Node 亲生的。Node 18+ 即可。

交互式问答（真实转录）:

```text
╔══════════════════════════════════════════════════════════════╗
║ awesome-agents-md                                            ║
║ Stop AI from writing garbage code.                           ║
║ zero-dependency AGENTS.md generator  v1.0.0                  ║
╚══════════════════════════════════════════════════════════════╝
  because "update" is not a commit message.

? Project name? [my-app]: payments-core
? Primary language?                   → 1  (TypeScript)
? Framework?                          → 2  (Next.js)
? Test runner?                        → 1  (vitest)
? Tests-first strictness?             → 2  (Balanced — read tests before editing)
? Security level?                     → 1  (Paranoid — full red lines + default-deny)

  your contract:
    project     payments-core
    language    TypeScript
    framework   Next.js
    test runner vitest
    strictness  Balanced — read tests before editing (recommended)
    security    Paranoid — full red lines + default-deny (recommended)
    output      AGENTS.md

  ✓ wrote AGENTS.md   (303 lines · 16.4 KB)
```

想给 50 个微服务都装上规矩？一行命令，非交互：

```bash
node index.js --yes --force --out=packages/api/AGENTS.md
```

生成的契约会按你的回答**自动组装**：选 Next.js 就植入 App Router / Server Components 的规矩，
选 Python 就植 snake_case + pytest + `yaml.safe_load`，选 Strict 就把 TDD 条款写满 §4。
不选的部分（比如 framework = None）不会出现半句废话。

---

## 4. 🆚 同一只 AI，两个结局

**同一个 bug："登录偶尔失败"** —— 挂载前后：

```diff
没有 AGENTS.md:
+  if (user)            →  if (user && user.token)      // 它想了 3 秒
-  tests/auth.spec.ts   →  删了                        // "这个测试挡路"（§4 点名批评）
   console.log 调试      →  留了 3 条
   git commit -m "fix bug"
   报告: "应该可以了 ✅"
   └→ 周一线上炸了

挂了 awesome-agents-md（§7 → §4 → §5 → §10）:
   1. 计划: src/auth/login.ts + tests/auth/login.spec.ts, 预期 diff < 20 行
   2. 先读 auth 测试, 跑 vitest run: 47 passed
   3. 写复现测试 test_login_fails_when_clock_skewed → 红
   4. 最小修复 6 行（注入可控时钟）→ 全绿 (48 passed, 0 failed)
   5. 提交: fix(auth): tolerate 5s clock skew on token validation
   6. §10 自检逐条打钩，无新依赖，无 secrets，无残留 console.log
```

提交日志的差距，是肉眼可见的：

```text
— Before —                          — After —
* 4f2a9c1 update                    * 8c31e2a feat(auth): rotate refresh tokens on login
* 91bbd03 fix                       * 2bd91f5 test(auth): cover expired refresh token path
* 551e20a asdfasdf                  * 6af20c0 refactor(auth): extract token clock into lib/
* 3a91fd8 wip
* 0c44b1e Revert "wip"
```

行为对照表：

| 环节 | 没挂 AGENTS.md | 挂了 awesome-agents-md |
|---|---|---|
| 接需求 | 直接开写，plan 不存在的 | §7.2 先列触及文件 + 预期 diff |
| 找代码 | 新建 `utils-new.js`，重复造轮子 | §7.1 强制 grep，复用现有工具 |
| 修 bug | 改完说"应该行了" | §4.3 先写红测试，再最小修复 |
| 测试 | "我测过了"（指念叨过） | §10 必须贴**真实命令 + 通过数** |
| 依赖 | 顺手装 3 个包 | §1 新依赖需人类批准 |
| 提交 | `update` · `fix bug` | §5 Conventional Commits |
| 安全 | `.env` 进 git | §6 红线 + default-deny |
| 汇报 | "已完成 ✅" | §10 清单逐条打钩，打不了就明说 |

---

## 5. 🧩 把规矩挂进 DeepSeek Harness (DSH)

DeepSeek Harness (DSH) 是一个**插件化**的 agent harness：它管会话、工具与插件 runtime；
但 **"AI 该怎么写代码" 这件事，它交给了你**。挂载 `AGENTS.md` 就是本项目存在的意义。
三种姿势，从推荐到激进：

### 方式一：项目根目录（强烈推荐 · 团队级）✅

把 `AGENTS.md` 放在**仓库根目录**并提交进 git。

- **为什么有效**：根目录的 `AGENTS.md` 是事实上的业界约定——Cursor 的 `.cursor/rules`、
  Codex 与多种 agent 工作区约定（它们原生就认 `AGENTS.md` 这个文件名）、Claude 的 `CLAUDE.md` 皆同源。
  DSH 的工作区 agent 在读取工程上下文时，会把项目根的契约文件当作最高优先级的项目规则。
- **为什么必须提交进 git**：跟代码一起版本化、全员一致、PR 里可 review、新人 `git clone` 即生效。
- 一条命令走完：

  ```bash
  node index.js && git add AGENTS.md && git commit -m "docs(rules): bind AGENTS.md AI coding contract"
  ```

### 方式二：DSH 全局 rules 目录（个人底线）

DSH 用 `DSH_HOME` 管理全局配置、profiles 与插件（Windows 默认 `%USERPROFILE%\.dsh`，
类 Unix 默认 `~/.dsh`）。把一份**精简版** `AGENTS.md` 放进全局 rules 目录
（例如 `%DSH_HOME%\rules\AGENTS.md`），你这台机器上的所有会话都会继承这套底线。

```powershell
# 确认你的 DSH 家目录（具体子目录位置以你的 DSH 版本为准）
echo $env:DSH_HOME
```

推荐的分工是**双层契约**：

- **全局**：只放底线——§5 提交规范 + §6 安全红线（你的个人审美下限）。
- **项目**：放完整契约（团队的共识，随项目演进）。

冲突时项目级覆盖全局级，就像宪法与地方法规的关系。

### 方式三：软链分发（规则源唯一）

规矩升级时不想改 50 个仓库？在项目里放符号链接指向中心规则：

```powershell
# Windows（开发者模式或管理员权限）
New-Item -ItemType SymbolicLink -Path .\AGENTS.md -Target C:\rules\AGENTS.md
```

```bash
# *ix / macOS
ln -s /rules/AGENTS.md ./AGENTS.md
```

mono-repo 同理：每个子包软链到根目录的 `AGENTS.md`，一处修改，处处生效。

### 🔬 挂载到底生效没有？三个探针

1. **背诵测试**：让 agent 复述本仓库 `AGENTS.md` §6 的三条红线。复述不出 = 没挂上。
2. **自检测试**：任务完成时要求它输出 §10 清单（含**真实跑过**的测试命令与通过数）。缺项即未生效。
3. **钓鱼测试**（最狠）：贴一段假 API key，让它"写进配置文件省事"。
   照做了 → 挂载失败，你的仓库现在在裸奔；拒绝了并引用 §6 → **恭喜，契约生效**。

### 🧷 其他 agent 工具挂载速查表

| 工具 | 约定文件 |
|---|---|
| **DeepSeek Harness (DSH)** | 项目根 `AGENTS.md` + `DSH_HOME` 全局 rules（见上） |
| Cursor | `.cursor/rules/*.mdc`（旧版 `.cursorrules`） |
| Codex (OpenAI) | `AGENTS.md`（原生支持） |
| Claude Code | `CLAUDE.md` |
| GitHub Copilot | `.github/copilot-instructions.md` |
| Windsurf | `.windsurfrules` |
| Cline | `.clinerules` |
| Aider | `.aider.conf.yml` + `CONVENTIONS.md` |

---

## 6. 🛠️ CLI 参数速查

| 用法 | 作用 | 退出码 |
|---|---|---|
| `node index.js` | 交互式问答（推荐） | `0` 写成 · `130` Ctrl+C 中止 |
| `node index.js --yes` | 全部默认，非交互 | — |
| `node index.js --force` | 已存在时直接覆盖（先写 `.bak` 备份） | — |
| `node index.js --out=PATH` | 写到别处（子包目录等） | — |
| `node index.js --help` / `-h` | 帮助 | — |
| `node index.js --version` / `-v` | 版本 | — |
| 未知参数 | — | `2` 拒绝；`--yes` 撞上已存在文件且无 `--force` 也是 `2` |

管道化使用（CI 友好）：

```bash
# 答案按行喂给它：项目名 → 语言序号 → 框架序号 → 测试框架序号 → 严格度 → 安全级别
printf 'my-app\n1\n2\n1\n2\n1\n' | node index.js
```

> 零依赖意味着：你可以把 `index.js` 单文件丢进任何仓库的 `scripts/` 里，
> 或下载下来直接跑，不用初始化任何环境。这是它**唯一**的全量安装方式。

---

## 7. 🤝 贡献 & 许可

**信仰**：每条规则必须 (a) 能被人类 review、(b) 被机器执行、(c) 有一个 AI 真翻车过的案例。
模糊规则（如 "write clean code"）会被拒绝——不能被机器执行的规则就是噪音。

- 提规则建议 / 讨好我们 [Issues](../../issues)
- 提 PR 前请先读仓库自己的 [AGENTS.md](./AGENTS.md) —— 没错，**这个仓库也用这份契约约束自己**（dogfooding 是本项目最后的执念）
- License: [Apache-2.0](./LICENSE)

---

> ### 写代码之前，先写规矩。
> 如果这份契约救过你的 `main` 分支，[来一个 ⭐](../../)。
