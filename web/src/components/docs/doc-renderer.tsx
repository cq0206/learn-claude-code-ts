"use client";

import { useMemo } from "react";
import { useLocale } from "@/lib/i18n";
import docsData from "@/data/generated/docs.json";
import versionsData from "@/data/generated/versions.json";
import { VERSION_META, type VersionId } from "@/lib/constants";
import { getVersionContent } from "@/lib/version-content";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeHighlight from "rehype-highlight";
import rehypeStringify from "rehype-stringify";

interface DocRendererProps {
  version?: string;
  slug?: string;
}

function isRangeSlug(slug?: string): boolean {
  return typeof slug === "string" && /^s\d+[a-c]?-s\d+[a-c]?/i.test(slug);
}

function looksPythonChapter(content: string): boolean {
  return /```python|\bpython\s+agents\/|under 30 lines of Python|python agents\/s\d+/i.test(content);
}

function buildTsHowItWorksSnippet(version: VersionId): string {
  const versionRecord = (versionsData as { versions: Array<{ id: string; filename: string; source: string }> }).versions.find(
    (item) => item.id === version
  );
  const source = versionRecord?.source || "";
  if (!source) return "// TypeScript source not available for this chapter.";

  const lines = source.split("\n");
  // Prefer the chapter-specific tail section in generated self-contained files.
  const chapterMarkerIdx = lines.findIndex((line) =>
    new RegExp(`agents_self_contained\\/${version}|agents\\/${version}`).test(line)
  );
  if (chapterMarkerIdx >= 0) {
    const chapterSnippet = lines
      .slice(chapterMarkerIdx + 1, chapterMarkerIdx + 33)
      .join("\n")
      .trim();
    if (chapterSnippet) return chapterSnippet;
  }

  const anchorIdx = lines.findIndex((line) => /runAgentLoop|runRepl|main\(|async function/.test(line));
  const start = anchorIdx > 8 ? anchorIdx - 8 : 0;
  const snippet = lines.slice(start, start + 32).join("\n").trim();
  return snippet || lines.slice(0, 32).join("\n").trim();
}

function replacePythonBlocksInSection(raw: string, sectionHeadingRe: RegExp, replacementTs: string): string {
  const startMatch = sectionHeadingRe.exec(raw);
  if (!startMatch || startMatch.index < 0) return raw;
  const start = startMatch.index;

  const tail = raw.slice(start + 1);
  const nextHeadingMatch = /^##\s+/m.exec(tail);
  const end =
    nextHeadingMatch && typeof nextHeadingMatch.index === "number"
      ? start + 1 + nextHeadingMatch.index
      : raw.length;

  const section = raw.slice(start, end);
  const replacedSection = section.replace(
    /```python[\s\S]*?```/gi,
    `\`\`\`ts\n${replacementTs}\n\`\`\``
  );
  return raw.slice(0, start) + replacedSection + raw.slice(end);
}

function replaceSection(raw: string, sectionHeadingRe: RegExp, replacementMarkdown: string): string {
  const startMatch = sectionHeadingRe.exec(raw);
  if (!startMatch || startMatch.index < 0) return raw;
  const start = startMatch.index;
  const tail = raw.slice(start + 1);
  const nextHeadingMatch = /^##\s+/m.exec(tail);
  const end =
    nextHeadingMatch && typeof nextHeadingMatch.index === "number"
      ? start + 1 + nextHeadingMatch.index
      : raw.length;
  return raw.slice(0, start) + replacementMarkdown + raw.slice(end);
}

function buildTsTryItSection(version: VersionId, locale: "zh" | "en" | "ja"): string {
  const runCmd = `npm run ${version}`;

  if (locale === "ja") {
    return `## 試してみる

\`\`\`bash
${runCmd}
\`\`\`

1. \`pwd\` を実行させる  
2. \`ls -la\` を実行させる  
3. 現在のワークスペース構造を1文で要約させる  
4. \`notes/hello.ts\` を作成し、内容を表示させる

`;
  }

  if (locale === "zh") {
    return `## Try It

\`\`\`bash
${runCmd}
\`\`\`

1. 让 agent 执行 \`pwd\`  
2. 让 agent 执行 \`ls -la\`  
3. 让 agent 用一句话总结当前工作区结构  
4. 让 agent 创建 \`notes/hello.ts\` 并显示文件内容

`;
  }

  return `## Try It

\`\`\`bash
${runCmd}
\`\`\`

1. Ask the agent to run \`pwd\`  
2. Ask it to run \`ls -la\`  
3. Ask it to summarize the current workspace in one sentence  
4. Ask it to create \`notes/hello.ts\` and print the file content

`;
}

function rewriteTryItSectionToTs(
  raw: string,
  version: VersionId,
  locale: "zh" | "en" | "ja"
): string {
  if (locale !== "en" && locale !== "ja") return raw;
  let out = raw;
  out = replaceSection(out, /^##\s+Try It\b/m, buildTsTryItSection(version, "en"));
  out = replaceSection(out, /^##\s+試してみる/m, buildTsTryItSection(version, "ja"));
  out = replaceSection(out, /^##\s+試してみよう/m, buildTsTryItSection(version, "ja"));
  return out;
}

function rewriteHowItWorksPythonToTs(
  raw: string,
  version: VersionId,
  locale: "zh" | "en" | "ja"
): string {
  if (locale !== "en" && locale !== "ja") return raw;
  if (!/```python/i.test(raw)) return raw;

  const tsSnippet = buildTsHowItWorksSnippet(version);
  let out = raw;
  // English long-form docs
  out = replacePythonBlocksInSection(out, /^##\s+How It Works\b/m, tsSnippet);
  // Japanese long-form docs
  out = replacePythonBlocksInSection(out, /^##\s+仕組み\b/m, tsSnippet);
  // Safety net: if any Python fenced code blocks remain, replace them too.
  out = out.replace(/```python[\s\S]*?```/gi, `\`\`\`ts\n${tsSnippet}\n\`\`\``);
  return out;
}

function buildTsChapterDoc(version: VersionId, locale: "zh" | "en" | "ja"): string {
  const versionRecord = (versionsData as { versions: Array<{ id: string; filename: string; source: string; tools: string[]; loc: number }> }).versions.find(
    (item) => item.id === version
  );
  const meta = VERSION_META[version];
  const content = getVersionContent(version, locale);
  const runCmd = `npm run ${version}`;
  const sourcePreview = (versionRecord?.source || "").split("\n").slice(0, 24).join("\n");
  const toolsText =
    versionRecord?.tools.length && versionRecord.tools.length > 0
      ? versionRecord.tools.join(", ")
      : locale === "zh"
        ? "由 runtime 组合注入（见源码）"
        : locale === "ja"
          ? "runtime で合成注入（ソース参照）"
          : "composed by runtime helpers (see source)";

  if (locale === "zh") {
    return `# ${version}: ${meta?.title ?? version}

> TypeScript 教学章节（本页内容由本仓库 TS 源码生成）

## 本章新增机制

- 核心增量：${content.coreAddition}
- 关键洞见：${content.keyInsight}
- 文件：\`${versionRecord?.filename ?? `${version}.ts`}\`
- 代码行数：${versionRecord?.loc ?? 0} LOC
- 工具：${toolsText}

## 运行方式

\`\`\`bash
${runCmd}
\`\`\`

## 源码预览（TypeScript）

\`\`\`ts
${sourcePreview}
\`\`\`
`;
  }

  if (locale === "ja") {
    return `# ${version}: ${meta?.title ?? version}

> TypeScript 学習章（このページは現在の TS ソースから生成）

## この章で追加されるもの

- Core addition: ${content.coreAddition}
- Key insight: ${content.keyInsight}
- File: \`${versionRecord?.filename ?? `${version}.ts`}\`
- LOC: ${versionRecord?.loc ?? 0}
- Tools: ${toolsText}

## 実行コマンド

\`\`\`bash
${runCmd}
\`\`\`

## Source Preview (TypeScript)

\`\`\`ts
${sourcePreview}
\`\`\`
`;
  }

  return `# ${version}: ${meta?.title ?? version}

> TypeScript learning chapter (rendered from this repo's TS source)

## What This Chapter Adds

- Core addition: ${content.coreAddition}
- Key insight: ${content.keyInsight}
- File: \`${versionRecord?.filename ?? `${version}.ts`}\`
- LOC: ${versionRecord?.loc ?? 0}
- Tools: ${toolsText}

## Run

\`\`\`bash
${runCmd}
\`\`\`

## Source Preview (TypeScript)

\`\`\`ts
${sourcePreview}
\`\`\`
`;
}

function buildTsCompanionSection(version: VersionId, locale: "zh" | "en" | "ja"): string {
  const versionRecord = (versionsData as { versions: Array<{ id: string; filename: string; source: string; tools: string[]; loc: number }> }).versions.find(
    (item) => item.id === version
  );
  const content = getVersionContent(version, locale);
  const runCmd = `npm run ${version}`;
  const sourcePreview = (versionRecord?.source || "").split("\n").slice(0, 24).join("\n");

  if (locale === "ja") {
    return `## TypeScript 対応（このリポジトリ）

- Core addition: ${content.coreAddition}
- Key insight: ${content.keyInsight}
- File: \`${versionRecord?.filename ?? `${version}.ts`}\`
- LOC: ${versionRecord?.loc ?? 0}

\`\`\`bash
${runCmd}
\`\`\`

\`\`\`ts
${sourcePreview}
\`\`\`
`;
  }

  if (locale === "zh") {
    return `## TypeScript 对照（本仓库）

- 核心增量：${content.coreAddition}
- 关键洞见：${content.keyInsight}
- 文件：\`${versionRecord?.filename ?? `${version}.ts`}\`
- 代码行数：${versionRecord?.loc ?? 0} LOC

\`\`\`bash
${runCmd}
\`\`\`

\`\`\`ts
${sourcePreview}
\`\`\`
`;
  }

  return `## TypeScript Companion (This Repo)

- Core addition: ${content.coreAddition}
- Key insight: ${content.keyInsight}
- File: \`${versionRecord?.filename ?? `${version}.ts`}\`
- LOC: ${versionRecord?.loc ?? 0}

\`\`\`bash
${runCmd}
\`\`\`

\`\`\`ts
${sourcePreview}
\`\`\`
`;
}

function appendTsCompanionIfNeeded(
  raw: string,
  version: VersionId,
  locale: "zh" | "en" | "ja"
): string {
  if (!looksPythonChapter(raw)) return raw;
  if (
    raw.includes("## TypeScript Companion (This Repo)") ||
    raw.includes("## TypeScript 对照（本仓库）") ||
    raw.includes("## TypeScript 対応（このリポジトリ）")
  ) {
    return raw;
  }
  return `${raw}\n\n---\n\n${buildTsCompanionSection(version, locale)}`;
}

function renderMarkdown(md: string): string {
  const result = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeHighlight, { detect: false, ignoreMissing: true })
    .use(rehypeStringify)
    .processSync(md);
  return String(result);
}

function postProcessHtml(html: string): string {
  // Add language labels to highlighted code blocks
  html = html.replace(
    /<pre><code class="hljs language-(\w+)">/g,
    '<pre class="code-block" data-language="$1"><code class="hljs language-$1">'
  );

  // Wrap plain pre>code (ASCII art / diagrams) in diagram container
  html = html.replace(
    /<pre><code(?! class="hljs)([^>]*)>/g,
    '<pre class="ascii-diagram"><code$1>'
  );

  // Mark the first blockquote as hero callout
  html = html.replace(
    /<blockquote>/,
    '<blockquote class="hero-callout">'
  );

  // Remove the h1 (it's redundant with the page header)
  html = html.replace(/<h1>.*?<\/h1>\n?/, "");

  // Fix ordered list counter for interrupted lists (ol start="N")
  html = html.replace(
    /<ol start="(\d+)">/g,
    (_, start) => `<ol style="counter-reset:step-counter ${parseInt(start) - 1}">`
  );

  // Wrap markdown tables so wide teaching maps scroll locally instead of
  // stretching the whole doc page.
  html = html.replace(/<table>/g, '<div class="table-scroll"><table>');
  html = html.replace(/<\/table>/g, "</table></div>");

  return html;
}

export function DocRenderer({ version, slug }: DocRendererProps) {
  const locale = useLocale();
  const normalizedLocale: "zh" | "en" | "ja" =
    locale === "zh" || locale === "ja" ? locale : "en";

  const doc = useMemo(() => {
    if (!version && !slug) return null;

    // For chapter pages, prefer locale-specific chapter docs first.
    // If a locale chapter is missing (or clearly Python-oriented), fallback to
    // other locale docs, then finally a TS-native generated summary.
    if (version) {
      if (!VERSION_META[version as VersionId]) return null;
      const versionId = version as VersionId;

      const withCompanion = (docObj: { content?: string } & Record<string, unknown>) => {
        const original = String(docObj.content || "");
        const replacedHow = rewriteHowItWorksPythonToTs(original, versionId, normalizedLocale);
        const replacedTry = rewriteTryItSectionToTs(replacedHow, versionId, normalizedLocale);
        const augmented = appendTsCompanionIfNeeded(replacedTry, versionId, normalizedLocale);
        if (augmented === original) return docObj;
        return { ...docObj, content: augmented };
      };

      const chapterByLocale = (targetLocale: string) =>
        docsData.find(
          (d: { version?: string | null; locale: string; kind?: string; slug?: string; content?: string }) =>
            d.version === version &&
            d.kind === "chapter" &&
            d.locale === targetLocale &&
            !isRangeSlug(d.slug)
        );

      const chapterCurrent = chapterByLocale(locale);
      if (chapterCurrent) return withCompanion(chapterCurrent);

      const chapterZh = chapterByLocale("zh");
      if (chapterZh) {
        return withCompanion(chapterZh);
      }

      const chapterEn = chapterByLocale("en");
      if (chapterEn) {
        return withCompanion(chapterEn);
      }

      return { content: buildTsChapterDoc(versionId, normalizedLocale) };
    }

    const match = docsData.find(
      (d: { version?: string | null; slug?: string; locale: string; kind?: string }) =>
        (version ? d.version === version && d.kind === "chapter" : d.slug === slug) &&
        d.locale === locale
    );
    if (match) return match;
    const zhFallback = docsData.find(
      (d: { version?: string | null; slug?: string; locale: string; kind?: string }) =>
        (version ? d.version === version && d.kind === "chapter" : d.slug === slug) &&
        d.locale === "zh"
    );
    if (zhFallback) return zhFallback;
    return docsData.find(
      (d: { version?: string | null; slug?: string; locale: string; kind?: string }) =>
        (version ? d.version === version && d.kind === "chapter" : d.slug === slug) &&
        d.locale === "en"
    );
  }, [version, slug, locale, normalizedLocale]);

  if (!doc) return null;

  const docContent = typeof doc.content === "string" ? doc.content : "";

  const html = useMemo(() => {
    const raw = renderMarkdown(docContent);
    return postProcessHtml(raw);
  }, [docContent]);

  return (
    <div className="py-4">
      <div
        className="prose-custom"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
