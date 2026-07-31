import { LinkOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { useState, type ReactNode } from 'react';
import { Drawer, Empty, Tooltip, Typography } from 'antd';
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
          {loading ? '检索中' : '已完成'}
        </span>
      </div>

      <Typography.Paragraph className={styles.searchQuery}>
        检索词：{preview.query}
      </Typography.Paragraph>

      {preview.results.length > 0 ? (
        <div className={styles.searchList}>
          {preview.results.map((item, index) => (
            <article
              key={`${item.url}-${index}`}
              className={styles.searchCard}
            >
              <Typography.Text className={styles.searchCardTitle}>
                {item.title}
              </Typography.Text>
              <span className={styles.searchSource}>{item.source}</span>
              <Typography.Paragraph className={styles.searchSnippet}>
                {item.snippet}
              </Typography.Paragraph>
              <a
                className={styles.link}
                href={item.url}
                target="_blank"
                rel="noreferrer noopener"
              >
                <LinkOutlined aria-hidden="true" /> {item.url}
              </a>
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
            </div>
          </section>
        </div>
      ))}
    </div>
  );
}

const RESEARCH_PILLAR_TITLES = RESEARCH_DIRECTION_SUMMARY_PILLARS.map(
  (item) => item.title,
);

function buildResearchSummaryView(summary: string) {
  const text = summary.trim();
  if (!text) {
    return {
      lead: '',
      pillars: [] as { title: string; body: string }[],
      outlook: '',
    };
  }

  let remaining = text;
  let lead = '';
  const firstTitleIndex = RESEARCH_PILLAR_TITLES.reduce((min, title) => {
    const idx = remaining.indexOf(`${title}：`);
    if (idx < 0) {
      return min;
    }
    return min < 0 ? idx : Math.min(min, idx);
  }, -1);

  if (firstTitleIndex > 0) {
    lead = remaining.slice(0, firstTitleIndex).trim();
    remaining = remaining.slice(firstTitleIndex);
  } else if (firstTitleIndex < 0) {
    if (remaining.startsWith('综合来看')) {
      return { lead: '', pillars: [], outlook: remaining };
    }
    return { lead: remaining, pillars: [], outlook: '' };
  }

  const pillars: { title: string; body: string }[] = [];
  for (let i = 0; i < RESEARCH_PILLAR_TITLES.length; i += 1) {
    const title = RESEARCH_PILLAR_TITLES[i]!;
    const marker = `${title}：`;
    const start = remaining.indexOf(marker);
    if (start < 0) {
      break;
    }
    const bodyStart = start + marker.length;
    const nextTitle = RESEARCH_PILLAR_TITLES[i + 1];
    let end = remaining.length;
    if (nextTitle) {
      const nextIdx = remaining.indexOf(`${nextTitle}：`, bodyStart);
      if (nextIdx >= 0) {
        end = nextIdx;
      }
    }
    const outlookIdx = remaining.indexOf('综合来看', bodyStart);
    if (outlookIdx >= 0 && outlookIdx < end) {
      end = outlookIdx;
    }
    pillars.push({
      title,
      body: remaining.slice(bodyStart, end).trim(),
    });
    remaining = remaining.slice(end);
  }

  const outlook = remaining.trim();
  if (!lead && !pillars.length && !outlook) {
    return { lead: text, pillars: [], outlook: '' };
  }
  return { lead, pillars, outlook };
}

interface ResearchDirectionPanelProps {
  result: ResearchDirectionResult;
  expertsSlot: ReactNode;
}

function ResearchDirectionPanel({
  result,
  expertsSlot,
  streaming,
}: ResearchDirectionPanelProps & { streaming?: boolean }) {
  const hasSummary = Boolean(result.summary?.trim());
  const showSummary = hasSummary || Boolean(streaming);
  const view = buildResearchSummaryView(result.summary ?? '');
  const showCaretOnLead =
    Boolean(streaming) &&
    Boolean(view.lead) &&
    view.pillars.length === 0 &&
    !view.outlook;
  const showCaretOnLastPillar =
    Boolean(streaming) &&
    view.pillars.length > 0 &&
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
        <section className={styles.summaryStack} aria-label="研发方向总结">
          <div className={styles.sectionHead}>
            <Typography.Text className={styles.sectionTitle}>
              二、研发方向总结
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
                    总体判断
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
                <div className={styles.summaryPillarList}>
                  <Typography.Text className={styles.summaryLayerLabel}>
                    重点方向
                  </Typography.Text>
                  {view.pillars.map((item, index) => {
                    const isLast = index === view.pillars.length - 1;
                    return (
                      <article
                        key={item.title}
                        className={styles.summaryPillarCard}
                      >
                        <div className={styles.summaryPillarHead}>
                          <span className={styles.summaryPillarIndex}>
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <Typography.Text className={styles.summaryPillarTitle}>
                            {item.title}
                          </Typography.Text>
                        </div>
                        <Typography.Paragraph className={styles.summaryText}>
                          {item.body}
                          {showCaretOnLastPillar && isLast ? (
                            <span
                              className={styles.typingCaret}
                              aria-hidden="true"
                            />
                          ) : null}
                        </Typography.Paragraph>
                      </article>
                    );
                  })}
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
