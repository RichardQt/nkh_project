import { LinkOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { useState, type ReactNode } from 'react';
import { Button, Drawer, Empty, Modal, Tooltip, Typography, message } from 'antd';
import type {
  AchievementEvalDimension,
  AchievementEvalResult,
  MunicipalPolicy,
  PolicyMatchGroup,
  PolicyRecommendResult,
  ProvincialPolicy,
  ResearchDirectionResult,
  SceneResult,
  SearchPreviewState,
} from '../../types/scene';
import { RESEARCH_DIRECTION_SUMMARY_PILLARS } from '../../data/sceneMocks';
import { MarkdownContent } from '../MarkdownContent/MarkdownContent';
import styles from './SceneResults.module.css';

interface SearchPreviewPanelProps {
  preview: SearchPreviewState;
  reduceMotion?: boolean | null;
}

export function SearchPreviewPanel({
  preview,
  reduceMotion,
}: SearchPreviewPanelProps) {
  const loading = preview.status === 'loading';
  const statusLabel = loading
    ? preview.statusHint?.trim() || '检索中'
    : '已完成';

  return (
    <section className={styles.searchPanel} aria-label="搜索引擎结果">
      <div className={styles.searchHead}>
        <Typography.Text className={styles.searchTitle}>
          搜索引擎结果
          <span className={styles.count}>{preview.results.length || '…'}</span>
        </Typography.Text>
        <span className={styles.searchStatus}>
          <span
            className={`${styles.searchStatusDot} ${
              loading && !reduceMotion ? styles.searchStatusDotPulse : ''
            }`}
            aria-hidden="true"
          />
          {statusLabel}
        </span>
      </div>

      {loading && preview.statusHint?.trim() ? (
        <Typography.Paragraph className={styles.searchHint}>
          {preview.statusHint.trim()}
        </Typography.Paragraph>
      ) : null}

      {preview.query ? (
        <Typography.Paragraph className={styles.searchQuery}>
          检索词：{preview.query}
        </Typography.Paragraph>
      ) : null}

      {preview.results.length > 0 ? (
        <div className={styles.searchDocs}>
          {preview.results.map((item, index) => (
            <article
              key={`${item.url ?? item.title}-${index}`}
              className={styles.searchDoc}
            >
              <Typography.Text className={styles.searchCardTitle}>
                {item.title}
              </Typography.Text>
              {item.snippet ? (
                <div className={styles.searchField}>
                  <span className={styles.searchFieldLabel}>简介</span>
                  <div className={styles.searchSnippet}>
                    <MarkdownContent content={item.snippet} />
                  </div>
                </div>
              ) : null}
              {item.url ? (
                <div className={styles.searchField}>
                  <span className={styles.searchFieldLabel}>链接</span>
                  <a
                    className={styles.link}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    <LinkOutlined aria-hidden="true" /> {item.url}
                  </a>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

type PolicyField = { label: string; value: string; isLink?: boolean };

type PolicyDetailState = {
  title: string;
  levelLabel: string;
  listFields: PolicyField[];
  detailFields: PolicyField[];
};

function displayValue(value: string | undefined | null): string {
  const text = (value ?? '').trim();
  return text || '—';
}

function FieldRows({ fields }: { fields: PolicyField[] }) {
  return (
    <dl className={styles.fieldGrid}>
      {fields.map((field) => (
        <div key={field.label} className={styles.fieldRow}>
          <dt className={styles.fieldLabel}>{field.label}</dt>
          <dd className={styles.fieldValue}>
            {field.isLink && field.value.trim() && field.value !== '—' ? (
              <a
                className={styles.link}
                href={field.value}
                target="_blank"
                rel="noreferrer noopener"
              >
                <LinkOutlined aria-hidden="true" /> {field.value}
              </a>
            ) : (
              displayValue(field.value)
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function provincialListFields(item: ProvincialPolicy): PolicyField[] {
  return [
    { label: '事项名称', value: item.item_name },
    { label: '级别', value: item.level },
    { label: '资助金额', value: item.funding_amount },
  ];
}

function provincialDetailFields(item: ProvincialPolicy): PolicyField[] {
  return [
    {
      label: '事项类别介绍',
      value: item.item_category_description,
    },
    { label: '项目介绍', value: item.project_description },
    { label: '申报要求', value: item.application_requirements },
    { label: '申报途径', value: item.application_channel },
    {
      label: '申报网址',
      value: item.application_url,
      isLink: true,
    },
    {
      label: '相关政策文件名称',
      value: item.related_policy_document_name,
    },
  ];
}

function municipalListFields(item: MunicipalPolicy): PolicyField[] {
  return [
    { label: '政策类别', value: item.policy_category },
    { label: '支持区域', value: item.supported_region },
    { label: '支持对象', value: item.supported_entities },
    { label: '支持内容', value: item.support_content },
  ];
}

function municipalDetailFields(item: MunicipalPolicy): PolicyField[] {
  return [
    { label: '支持内容', value: item.support_content },
    { label: '来源文件', value: item.source_document },
  ];
}

function PolicyEntryCard({
  title,
  fields,
  onOpen,
}: {
  title: string;
  fields: PolicyField[];
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.policyEntryCard}
      onClick={onOpen}
      aria-label={`查看详情：${title}`}
    >
      <div className={styles.policyEntryHead}>
        <Typography.Text className={styles.cardTitle}>{title}</Typography.Text>
        <span className={styles.policyEntryHint}>详情</span>
      </div>
      <FieldRows fields={fields} />
    </button>
  );
}

function PolicyLevelBlock({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <div className={styles.policyLevelBlock} aria-label={label}>
      <Typography.Text className={styles.policyLevelTitle}>
        {label}
        <span className={styles.count}>{count}</span>
      </Typography.Text>
      <div className={styles.cardList}>{children}</div>
    </div>
  );
}

function PolicyMatchSection({
  title,
  badgeClass,
  badgeText,
  group,
  onOpenProvincial,
  onOpenMunicipal,
}: {
  title: string;
  badgeClass: string;
  badgeText: string;
  group: PolicyMatchGroup;
  onOpenProvincial: (item: ProvincialPolicy) => void;
  onOpenMunicipal: (item: MunicipalPolicy) => void;
}) {
  const provincial = group?.provincial ?? [];
  const municipal = group?.municipal ?? [];
  const total = provincial.length + municipal.length;
  const hasProvincial = provincial.length > 0;
  const hasMunicipal = municipal.length > 0;

  return (
    <section className={styles.section} aria-label={title}>
      <div className={styles.sectionHead}>
        <Typography.Text className={styles.sectionTitle}>
          {title}
          <span className={styles.count}>{total}</span>
        </Typography.Text>
        <span className={`${styles.badge} ${badgeClass}`}>{badgeText}</span>
      </div>

      {total === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={`暂无${title}`}
          className={styles.policyEmpty}
        />
      ) : (
        <div className={styles.policyLevelStack}>
          {hasProvincial ? (
            <PolicyLevelBlock label="省级政策" count={provincial.length}>
              {provincial.map((item) => (
                <PolicyEntryCard
                  key={item.id}
                  title={item.item_name}
                  fields={provincialListFields(item)}
                  onOpen={() => onOpenProvincial(item)}
                />
              ))}
            </PolicyLevelBlock>
          ) : null}

          {hasMunicipal ? (
            <PolicyLevelBlock label="市级政策" count={municipal.length}>
              {municipal.map((item) => (
                <PolicyEntryCard
                  key={item.id}
                  title={item.policy_category}
                  fields={municipalListFields(item)}
                  onOpen={() => onOpenMunicipal(item)}
                />
              ))}
            </PolicyLevelBlock>
          ) : null}
        </div>
      )}
    </section>
  );
}

function PolicyRecommendPanel({ result }: { result: PolicyRecommendResult }) {
  const [detail, setDetail] = useState<PolicyDetailState | null>(null);

  const openProvincial = (item: ProvincialPolicy, levelLabel: string) => {
    setDetail({
      title: item.item_name,
      levelLabel,
      listFields: provincialListFields(item),
      detailFields: provincialDetailFields(item),
    });
  };

  const openMunicipal = (item: MunicipalPolicy, levelLabel: string) => {
    setDetail({
      title: item.policy_category,
      levelLabel,
      listFields: municipalListFields(item),
      detailFields: municipalDetailFields(item),
    });
  };

  return (
    <div className={styles.panel}>
      <PolicyMatchSection
        title="完全满足政策"
        badgeClass={styles.badgeFull}
        badgeText="完全匹配"
        group={result.fullyMatched}
        onOpenProvincial={(item) => openProvincial(item, '省级政策')}
        onOpenMunicipal={(item) => openMunicipal(item, '市级政策')}
      />
      <PolicyMatchSection
        title="部分满足政策"
        badgeClass={styles.badgePartial}
        badgeText="部分匹配"
        group={result.partiallyMatched}
        onOpenProvincial={(item) => openProvincial(item, '省级政策')}
        onOpenMunicipal={(item) => openMunicipal(item, '市级政策')}
      />

      {result.recommendReason?.trim() ? (
        <section className={styles.section} aria-label="推荐理由">
          <div className={styles.recommendReasonCard}>
            <Typography.Text className={styles.summaryLayerLabel}>
              申报建议
            </Typography.Text>
            <MarkdownContent
              content={result.recommendReason}
              className={styles.summaryText}
            />
          </div>
        </section>
      ) : null}

      <Drawer
        title={
          <div className={styles.policyDetailTitle}>
            <span className={styles.policyDetailName}>
              {detail?.title ?? '详情'}
            </span>
            {detail?.levelLabel ? (
              <span className={styles.policyDetailBadge}>
                {detail.levelLabel}
              </span>
            ) : null}
          </div>
        }
        placement="right"
        width={440}
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        destroyOnHidden
        className={styles.policyDetailDrawer}
        styles={{ body: { paddingTop: 12 } }}
      >
        {detail ? (
          <div className={styles.policyDetailBody}>
            <div className={styles.policyDetailBlock}>
              <Typography.Text className={styles.policyDetailBlockTitle}>
                基本信息
              </Typography.Text>
              <div className={styles.policyDetailFields}>
                <FieldRows fields={detail.listFields} />
              </div>
            </div>
            <div className={styles.policyDetailBlock}>
              <Typography.Text className={styles.policyDetailBlockTitle}>
                详细信息
              </Typography.Text>
              <div className={styles.policyDetailFields}>
                <FieldRows fields={detail.detailFields} />
              </div>
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}

function DimensionScoreCard({
  item,
  index,
}: {
  item: AchievementEvalDimension;
  index: number;
}) {
  return (
    <article className={styles.dimensionCard}>
      <div className={styles.dimensionHead}>
        <div className={styles.dimensionLabelRow}>
          <span className={styles.dimensionIndex}>
            {String(index + 1).padStart(2, '0')}
          </span>
          <span className={styles.dimensionLabel}>{item.label}</span>
          {item.weakness?.trim() ? (
            <Tooltip
              title={
                <div className={styles.weaknessTooltip}>
                  <div className={styles.weaknessTooltipTitle}>不足</div>
                  <div className={styles.weaknessTooltipBody}>
                    {item.weakness}
                  </div>
                </div>
              }
              placement="top"
              mouseEnterDelay={0.15}
              overlayStyle={{ maxWidth: 360 }}
            >
              <button
                type="button"
                className={styles.weaknessHint}
                aria-label={`${item.label}不足说明`}
              >
                <QuestionCircleOutlined aria-hidden="true" />
              </button>
            </Tooltip>
          ) : null}
        </div>
        <span className={styles.dimensionScore}>
          <span className={styles.dimensionScoreNum}>{item.score}</span>
          <span className={styles.dimensionScoreMax}>/{item.max}</span>
        </span>
      </div>
      <div className={styles.highlightBlock}>
        <span className={styles.highlightLabel}>亮点</span>
        <Typography.Paragraph className={styles.highlightText}>
          {item.highlight}
        </Typography.Paragraph>
      </div>
    </article>
  );
}

function AchievementEvalPanel({ result }: { result: AchievementEvalResult }) {
  if (!result.evaluations.length) {
    return null;
  }

  return (
    <div className={styles.panel}>
      {result.evaluations.map((item, index) => (
        <div key={`${item.title}-${index}`} className={styles.evalStack}>
          <header className={styles.evalHero}>
            <Typography.Text className={styles.evalHeroLabel}>
              评估对象
            </Typography.Text>
            <Typography.Text className={styles.evalHeroTitle}>
              {item.title}
            </Typography.Text>
            <div className={styles.evalHeroScore}>
              <span className={styles.evalHeroScoreLabel}>总得分</span>
              <span className={styles.evalHeroScoreValue}>
                {item.total}
                <span className={styles.evalHeroScoreMax}>/{item.maxTotal}</span>
              </span>
            </div>
          </header>

          <section className={styles.summaryStack} aria-label="评分总结">
            <div className={styles.sectionHead}>
              <Typography.Text className={styles.sectionTitle}>
                一、评分总结
              </Typography.Text>
            </div>

            <div className={styles.summaryLayers}>
              {item.dimensions.length > 0 ? (
                <div className={styles.evalLayerBlock}>
                  <Typography.Text className={styles.summaryLayerLabel}>
                    评分维度
                  </Typography.Text>
                  <div className={styles.dimensionList}>
                    {item.dimensions.map((dim, dimIndex) => (
                      <DimensionScoreCard
                        key={dim.label}
                        item={dim}
                        index={dimIndex}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {item.reason.trim() ? (
                <div
                  className={`${styles.recommendReasonCard} ${styles.evalReasonCard}`}
                >
                  <Typography.Text className={styles.summaryLayerLabel}>
                    评分原因
                  </Typography.Text>
                  <MarkdownContent
                    content={item.reason}
                    className={styles.reasonText}
                  />
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ))}
    </div>
  );
}

/** Match mock flatten blocks: short title + fullwidth colon + body. */
const PILLAR_BLOCK_RE = /^(.{1,40}?)[：:]([\s\S]+)$/;

function parsePillarBlock(block: string): { title: string; body: string } | null {
  const match = block.match(PILLAR_BLOCK_RE);
  if (!match) {
    return null;
  }
  const title = match[1]!.trim();
  const body = match[2]!.trim();
  if (!title || !body) {
    return null;
  }
  // Avoid treating long prose paragraphs as list titles.
  if (/[。；;\n]/.test(title) || title.startsWith('综合来看')) {
    return null;
  }
  return { title, body };
}

function buildResearchSummaryView(summary: string) {
  const text = summary.trim();
  if (!text) {
    return {
      lead: '',
      pillars: [] as { title: string; body: string }[],
      outlook: '',
    };
  }

  // Prefer structured mock pillars once the full flattened summary is present
  // (avoids title hardcoding; still works while streaming via block parse).
  const fullMock = RESEARCH_DIRECTION_SUMMARY_PILLARS.every((item) =>
    text.includes(`${item.title}：`) || text.includes(`${item.title}:`),
  );
  if (fullMock && RESEARCH_DIRECTION_SUMMARY_PILLARS.length > 0) {
    const firstTitle = RESEARCH_DIRECTION_SUMMARY_PILLARS[0]!.title;
    const firstIdxFull = text.indexOf(`${firstTitle}：`);
    const firstIdxHalf = text.indexOf(`${firstTitle}:`);
    const firstIdx =
      firstIdxFull >= 0
        ? firstIdxFull
        : firstIdxHalf >= 0
          ? firstIdxHalf
          : -1;
    const outlookIdx = text.indexOf('综合来看');
    const lead =
      firstIdx > 0 ? text.slice(0, firstIdx).trim() : '';
    const outlook =
      outlookIdx >= 0 ? text.slice(outlookIdx).trim() : '';
    return {
      lead,
      pillars: RESEARCH_DIRECTION_SUMMARY_PILLARS.map((item) => ({
        title: item.title,
        body: item.body.trim(),
      })),
      outlook,
    };
  }

  // Generic parse for streaming partial text / non-mock payloads.
  const blocks = text
    .split(/\n\n+/)
    .map((item) => item.trim())
    .filter(Boolean);

  let lead = '';
  const pillars: { title: string; body: string }[] = [];
  let outlook = '';

  for (const block of blocks) {
    if (block.startsWith('综合来看')) {
      outlook = outlook ? `${outlook}\n\n${block}` : block;
      continue;
    }
    const pillar = parsePillarBlock(block);
    if (pillar) {
      pillars.push(pillar);
      continue;
    }
    if (!pillars.length && !outlook) {
      lead = lead ? `${lead}\n\n${block}` : block;
    } else if (!outlook) {
      // Trailing prose without title marker folds into last pillar body.
      const last = pillars[pillars.length - 1];
      if (last) {
        last.body = `${last.body}\n\n${block}`.trim();
      } else {
        lead = lead ? `${lead}\n\n${block}` : block;
      }
    } else {
      outlook = `${outlook}\n\n${block}`;
    }
  }

  if (!lead && !pillars.length && !outlook) {
    return { lead: text, pillars: [], outlook: '' };
  }
  return { lead, pillars, outlook };
}

interface ResearchDirectionPanelProps {
  result: ResearchDirectionResult;
  expertsSlot: ReactNode;
}

type DemandDirectionDetail = {
  title: string;
  body: string;
};

function demandDirectionFields(item: DemandDirectionDetail): PolicyField[] {
  return [
    { label: '需求方向', value: item.title },
    { label: '简介', value: item.body },
  ];
}

function ResearchDirectionPanel({
  result,
  expertsSlot,
  streaming,
}: ResearchDirectionPanelProps & { streaming?: boolean }) {
  const [detail, setDetail] = useState<DemandDirectionDetail | null>(null);
  const [interviewOpen, setInterviewOpen] = useState(false);
  const hasSummary = Boolean(result.summary?.trim());
  const showSummary = hasSummary || Boolean(streaming);
  const view = buildResearchSummaryView(result.summary ?? '');
  const showCaretOnLead =
    Boolean(streaming) &&
    Boolean(view.lead) &&
    view.pillars.length === 0 &&
    !view.outlook;
  const showCaretOnOutlook = Boolean(streaming) && Boolean(view.outlook);

  return (
    <div className={styles.panel}>
      <section className={styles.section} aria-label="专家展示">
        <div className={styles.sectionHead}>
          <Typography.Text className={styles.sectionTitle}>
            一、专家展示
          </Typography.Text>
        </div>
        {expertsSlot}
        {result.recommendReason?.trim() ? (
          <div className={styles.recommendReasonCard}>
            <Typography.Text className={styles.summaryLayerLabel}>
              推荐理由
            </Typography.Text>
            <MarkdownContent
              content={result.recommendReason}
              className={styles.summaryText}
            />
          </div>
        ) : null}
      </section>

      {showSummary ? (
        <section className={styles.summaryStack} aria-label="企业潜在需求">
          <div className={styles.sectionHead}>
            <Typography.Text className={styles.sectionTitle}>
              二、企业潜在需求
              {streaming ? (
                <span className={styles.streamingHint}>生成中</span>
              ) : null}
            </Typography.Text>
          </div>

          {!hasSummary ? (
            <div className={styles.summaryCard}>
              <Typography.Paragraph className={styles.summaryText}>
                正在生成…
                <span className={styles.typingCaret} aria-hidden="true" />
              </Typography.Paragraph>
            </div>
          ) : (
            <div className={styles.summaryLayers}>
              {view.lead ? (
                <div className={styles.summaryLeadCard}>
                  <Typography.Text className={styles.summaryLayerLabel}>
                    企业潜在需求总结
                  </Typography.Text>
                  <Typography.Paragraph className={styles.summaryText}>
                    {view.lead}
                    {showCaretOnLead ? (
                      <span className={styles.typingCaret} aria-hidden="true" />
                    ) : null}
                  </Typography.Paragraph>
                </div>
              ) : null}

              {view.pillars.length > 0 ? (
                <div className={styles.demandDirectionBlock}>
                  <Typography.Text className={styles.summaryLayerLabel}>
                    潜在需求方向
                    <span className={styles.count}>{view.pillars.length}</span>
                  </Typography.Text>
                  <div className={styles.cardList}>
                    {view.pillars.map((item) => (
                      <PolicyEntryCard
                        key={item.title}
                        title={item.title}
                        fields={demandDirectionFields(item)}
                        onOpen={() =>
                          setDetail({ title: item.title, body: item.body })
                        }
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {view.outlook ? (
                <div className={styles.summaryOutlookCard}>
                  <Typography.Text className={styles.summaryLayerLabel}>
                    综合研判
                  </Typography.Text>
                  <Typography.Paragraph className={styles.summaryText}>
                    {view.outlook}
                    {showCaretOnOutlook ? (
                      <span className={styles.typingCaret} aria-hidden="true" />
                    ) : null}
                  </Typography.Paragraph>
                </div>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      <Drawer
        title={
          <div className={styles.policyDetailTitle}>
            <span className={styles.policyDetailName}>
              {detail?.title ?? '详情'}
            </span>
            <span className={styles.policyDetailBadge}>潜在需求</span>
          </div>
        }
        extra={
          detail ? (
            <Button
              type="primary"
              size="small"
              className={styles.interviewApplyBtn}
              onClick={() => setInterviewOpen(true)}
            >
              需求面谈
            </Button>
          ) : null
        }
        placement="right"
        width={440}
        open={Boolean(detail)}
        onClose={() => {
          setDetail(null);
          setInterviewOpen(false);
        }}
        destroyOnHidden
        className={styles.policyDetailDrawer}
        styles={{ body: { paddingTop: 12 } }}
      >
        {detail ? (
          <div className={styles.policyDetailBody}>
            <div className={styles.policyDetailBlock}>
              <Typography.Text className={styles.policyDetailBlockTitle}>
                基本信息
              </Typography.Text>
              <div className={styles.policyDetailFields}>
                <FieldRows fields={demandDirectionFields(detail)} />
              </div>
            </div>
          </div>
        ) : null}
      </Drawer>

      <Modal
        open={interviewOpen}
        onCancel={() => setInterviewOpen(false)}
        footer={null}
        centered
        width={420}
        destroyOnHidden
        className={styles.interviewModal}
        styles={{
          body: { padding: '8px 8px 4px' },
        }}
      >
        <div className={styles.interviewModalBody}>
          <Typography.Title level={5} className={styles.interviewModalTitle}>
            想要发布或对接需求、成果吗？
          </Typography.Title>
          <Typography.Paragraph className={styles.interviewModalLead}>
            只差一步之遥！
          </Typography.Paragraph>
          <Typography.Paragraph className={styles.interviewModalDesc}>
            个人用户请先认证成为技术经理人或通过单位账号登录后才能享受全部平台功能。
          </Typography.Paragraph>
          <div className={styles.interviewModalActions}>
            <Button
              className={styles.interviewModalLater}
              onClick={() => setInterviewOpen(false)}
            >
              稍后再说
            </Button>
            <Button
              type="primary"
              className={styles.interviewModalCertify}
              onClick={() => {
                setInterviewOpen(false);
                message.info('认证功能即将开放');
              }}
            >
              去认证
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}


interface SceneResultPanelProps {
  result: SceneResult;
  expertsSlot?: React.ReactNode;
  streaming?: boolean;
}

export function SceneResultPanel({
  result,
  expertsSlot,
  streaming,
}: SceneResultPanelProps) {
  if (result.kind === 'policy_recommend') {
    return <PolicyRecommendPanel result={result} />;
  }
  if (result.kind === 'achievement_eval') {
    return <AchievementEvalPanel result={result} />;
  }
  return (
    <ResearchDirectionPanel
      result={result}
      expertsSlot={expertsSlot ?? null}
      streaming={streaming}
    />
  );
}
