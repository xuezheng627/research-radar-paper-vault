# Daily Literature Digest + Paper Vault Skills

This repository contains two Codex skills that work together:

- `daily-literature-digest`: creates a daily research-paper digest from Crossref, OpenAlex, and arXiv, then sends it by Gmail.
- `paper-vault`: turns selected High/Medium papers from the digest into a local visual paper library after full-text reading.

Recommended workflow:

1. Install both skills.
2. Ask Codex to set up a daily literature digest with your own email, keywords, language, and timezone.
3. When useful papers appear in the digest, ask Codex to add the High/Medium papers to Paper Vault.
4. Paper Vault keeps only full-text-read papers as normal cards. Papers that still need publisher or university access go into a Full-Text Queue first.

## Install

Copy both skill folders into your Codex skills directory.

Windows PowerShell:

```powershell
$skills = "$env:USERPROFILE\.codex\skills"
New-Item -ItemType Directory -Path $skills -Force | Out-Null
Copy-Item -Recurse -Force .\daily-literature-digest "$skills\daily-literature-digest"
Copy-Item -Recurse -Force .\paper-vault "$skills\paper-vault"
```

macOS or Linux:

```bash
mkdir -p ~/.codex/skills
cp -R ./daily-literature-digest ~/.codex/skills/daily-literature-digest
cp -R ./paper-vault ~/.codex/skills/paper-vault
```

Restart Codex after copying the folders so the skills are discovered.

## Connect Gmail

Use the Gmail connector in Codex. The digest skill uses the connector to send email and does not require SMTP passwords.

If Gmail is not connected, ask Codex:

```text
Help me connect Gmail for my daily literature digest.
```

## Start Daily Digest

After installing the skills and connecting Gmail, tell Codex something like:

```text
Use $daily-literature-digest to create a daily literature digest.
Send it to me@example.com every day at 09:00.
Use Chinese.
My timezone is Europe/London.
My keywords are:
- 
```

Codex should create a personal config file, run a dry run, generate a local Markdown archive, send a test email if Gmail is available, and then create a daily 09:00 automation.

Important: local Codex automations depend on the Codex runner and computer being awake. If the computer is asleep or Codex is not running at 09:00, the email may not be sent on time.

## Start Paper Vault

After the daily digest has produced JSON or Markdown archives, ask Codex:

```text
Use $paper-vault to put the High and Medium papers from my daily literature digest into a Paper Vault.
Only add papers after reading the full text or local PDF.
Classify them based on my own research keywords.
Keep no more than 5 broad categories.
```

Paper Vault creates a local static website such as:

```text
paper-vault-site/
  index.html
  styles.css
  app.js
  data/
    papers.js
    paper-bilingual.js
    vault-settings.js
    fulltext-inbox.js
  notes/
  pdfs/
  sources/
```

Run it locally with:

```powershell
cd paper-vault-site
python -m http.server 8766 --bind 127.0.0.1
```

Open:

```text
http://127.0.0.1:8766/index.html
```

## Full-Text Rule

Paper Vault is designed as a full-text paper library, not an abstract-only bookmark list.

- If a paper has an open PDF or local PDF, Codex can read it and add it to the main vault.
- If a High/Medium paper needs university or publisher access, Codex should ask whether you want to log in now.
- If you log in through the active browser session, Codex can process that explicit batch only.
- If you do not log in now, the paper is saved to the Full-Text Queue and is not shown as a normal card.

Codex must not store passwords, cookies, login pages, or institutional session traces.

## Encoding Safety

All files in this repository should stay UTF-8. If you edit Chinese text on Windows, avoid writing Chinese through PowerShell heredocs that can turn text into question marks. Prefer a UTF-8 editor or Codex edits with `apply_patch`.

Before sharing, search the repository for broken text such as long runs of question marks or mojibake characters.

## What To Upload

Upload the whole repository folder:

```text
daily-literature-digest-skill/
  README.md
  LICENSE
  .gitignore
  daily-literature-digest/
  paper-vault/
```

Do not upload generated personal files, including:

- daily digest archives
- `state.json`
- personal config files
- PDFs
- DOCX files
- downloaded publisher pages
- cookies or login traces

---

# 每日文献日报 + Paper Vault 技能

这个仓库包含两个可以配合使用的 Codex skill：

- `daily-literature-digest`：每天从 Crossref、OpenAlex 和 arXiv 检索新论文，并通过 Gmail 发送文献日报。
- `paper-vault`：把日报中值得保留的 High/Medium 论文，在阅读全文后整理成一个本地可视化文献库。

推荐流程：

1. 同时安装两个 skill。
2. 让 Codex 根据你的邮箱、关键词、语言和时区创建每日文献日报。
3. 当日报里出现有价值的论文时，让 Codex 把 High/Medium 论文加入 Paper Vault。
4. Paper Vault 主页面只展示“已经读过全文”的论文；还没有全文权限的论文会先进入“待全文队列”。

## 安装

把两个 skill 文件夹复制到你的 Codex skills 目录。

Windows PowerShell：

```powershell
$skills = "$env:USERPROFILE\.codex\skills"
New-Item -ItemType Directory -Path $skills -Force | Out-Null
Copy-Item -Recurse -Force .\daily-literature-digest "$skills\daily-literature-digest"
Copy-Item -Recurse -Force .\paper-vault "$skills\paper-vault"
```

macOS 或 Linux：

```bash
mkdir -p ~/.codex/skills
cp -R ./daily-literature-digest ~/.codex/skills/daily-literature-digest
cp -R ./paper-vault ~/.codex/skills/paper-vault
```

复制完成后，重启 Codex，让 Codex 重新发现这两个 skill。

## 连接 Gmail

在 Codex 里连接 Gmail connector。日报 skill 会通过 Gmail connector 发邮件，不需要配置 SMTP 密码。

如果 Gmail 还没有连接，可以对 Codex 说：

```text
帮我连接 Gmail，用来发送每日文献日报。
```

## 启动每日文献日报

安装 skill 并连接 Gmail 后，可以对 Codex 说：

```text
使用 $daily-literature-digest 帮我创建每日文献日报。
每天早上 09:00 发到 me@example.com。
语言用中文。
我的时区是 Europe/London。
我的关键词是：
- 
```

Codex 应该会生成你的个人配置文件，先做一次 dry run，生成本地 Markdown 存档；如果 Gmail 可用，会发送测试邮件；最后创建每天 09:00 的自动化。

注意：本地 Codex 自动化依赖 Codex runner 和电脑处于运行状态。如果电脑在 09:00 睡眠，或者 Codex 没有运行，邮件可能不会准时发送。

## 启动 Paper Vault

当日报已经生成 JSON 或 Markdown 记录后，可以对 Codex 说：

```text
使用 $paper-vault 把每日文献日报里的 High 和 Medium 论文加入 Paper Vault。
只有读过全文或本地 PDF 后才加入主库。
按照我的研究关键词自动分类。
大类不要超过 5 个。
```

Paper Vault 会生成一个本地静态网页，例如：

```text
paper-vault-site/
  index.html
  styles.css
  app.js
  data/
    papers.js
    paper-bilingual.js
    vault-settings.js
    fulltext-inbox.js
  notes/
  pdfs/
  sources/
```

运行方式：

```powershell
cd paper-vault-site
python -m http.server 8766 --bind 127.0.0.1
```

然后打开：

```text
http://127.0.0.1:8766/index.html
```

## 全文规则

Paper Vault 的定位是“全文级文献库”，不是只读摘要的收藏夹。

- 如果论文有开放 PDF 或本地 PDF，Codex 可以读取全文后加入主库。
- 如果 High/Medium 论文需要学校或出版社权限，Codex 应主动询问你是否现在登录。
- 如果你通过当前浏览器完成登录，Codex 只能处理你明确允许的这一批论文。
- 如果你暂时不登录，论文会进入“待全文队列”，不会作为正式卡片显示。

Codex 不能保存你的密码、cookie、登录页面或学校账号 session。

## 编码安全

仓库里的文件都应该保持 UTF-8 编码。在 Windows 上编辑中文时，尽量不要用 PowerShell heredoc 写中文内容，因为这可能把中文变成问号。建议使用支持 UTF-8 的编辑器，或者让 Codex 用 `apply_patch` 修改。

分享前建议搜索仓库，确认没有大段问号或乱码字符。

## 需要上传哪些文件

上传整个仓库文件夹：

```text
daily-literature-digest-skill/
  README.md
  LICENSE
  .gitignore
  daily-literature-digest/
  paper-vault/
```

不要上传任何个人生成文件，例如：

- 每日文献日报历史记录
- `state.json`
- 个人配置文件
- PDF
- DOCX
- 下载过的出版社网页
- cookie 或登录痕迹
