import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Empty, Spin, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { queryKnowledgeGraph, KgQueryError } from '../../services/kgQuery';
import type { KgGraphData, KgNode, KgQueryTarget } from '../../types/kg';
import { isSameKgTarget, resolveKgNodeQuery } from '../../types/kg';
import { ForceGraph } from './ForceGraph';
import styles from './KnowledgeGraph.module.css';

export interface KnowledgeGraphViewProps {
  /** Root target to query; null shows idle empty state. */
  target: KgQueryTarget | null;
  /** Stretch canvas for full-page layout. */
  fillHeight?: boolean;
  /** Optional empty-state copy when no target yet. */
  idleDescription?: string;
  /** Fires when the active (possibly drilled) target changes. */
  onActiveTargetChange?: (target: KgQueryTarget | null) => void;
}

function formatPropValue(
  value: string | number | boolean | null | undefined,
): string {
  if (value == null || value === '') {
    return '-';
  }
  if (typeof value === 'boolean') {
    return value ? '是' : '否';
  }
  return String(value);
}

function targetKey(t: KgQueryTarget): string {
  return `${t.entityType}::${t.vid}`;
}

export function KnowledgeGraphView({
  target,
  fillHeight = false,
  idleDescription = '请输入实体类别与实体 VID 后查询',
  onActiveTargetChange,
}: KnowledgeGraphViewProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<KgGraphData | null>(null);
  const [selected, setSelected] = useState<KgNode | null>(null);
  const [activeTarget, setActiveTarget] = useState<KgQueryTarget | null>(null);
  const [history, setHistory] = useState<KgQueryTarget[]>([]);

  useEffect(() => {
    if (!target) {
      setActiveTarget(null);
      setHistory([]);
      setData(null);
      setSelected(null);
      setError(null);
      setLoading(false);
      return;
    }
    setActiveTarget(target);
    setHistory([]);
    setData(null);
    setSelected(null);
    setError(null);
  }, [target]);

  useEffect(() => {
    onActiveTargetChange?.(activeTarget);
  }, [activeTarget, onActiveTargetChange]);

  useEffect(() => {
    if (!activeTarget) {
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setData(null);
    setSelected(null);

    queryKnowledgeGraph(
      activeTarget.entityType,
      activeTarget.vid,
      controller.signal,
    )
      .then((graph) => {
        setData(graph);
        const center =
          graph.nodes.find((n) => n.id === graph.center_node_id) ??
          graph.nodes.find(
            (n) =>
              n.id === activeTarget.vid || n.name === activeTarget.vid,
          ) ??
          graph.nodes[0] ??
          null;
        setSelected(center);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        const message =
          err instanceof KgQueryError
            ? err.message
            : err instanceof Error
              ? err.message
              : '知识图谱加载失败';
        setError(message);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [activeTarget]);

  const drillToTarget = useCallback(
    (next: KgQueryTarget) => {
      if (!next.entityType || !next.vid) {
        return;
      }
      if (isSameKgTarget(next, activeTarget)) {
        return;
      }
      setHistory((prev) => {
        if (!activeTarget) {
          return prev;
        }
        const last = prev[prev.length - 1];
        if (last && isSameKgTarget(last, activeTarget)) {
          return prev;
        }
        return [...prev, activeTarget];
      });
      setActiveTarget(next);
    },
    [activeTarget],
  );

  const onSelectNode = useCallback((node: KgNode) => {
    setSelected(node);
  }, []);

  const onDrillNode = useCallback(
    (node: KgNode) => {
      const next = resolveKgNodeQuery(node);
      if (!next) {
        return;
      }
      drillToTarget(next);
    },
    [drillToTarget],
  );

  const goBack = useCallback(() => {
    setHistory((prev) => {
      if (prev.length === 0) {
        return prev;
      }
      const nextHistory = prev.slice(0, -1);
      const previous = prev[prev.length - 1];
      setActiveTarget(previous);
      return nextHistory;
    });
  }, []);

  const jumpToHistoryIndex = useCallback((index: number) => {
    setHistory((prev) => {
      if (index < 0 || index >= prev.length) {
        return prev;
      }
      const destination = prev[index];
      setActiveTarget(destination);
      return prev.slice(0, index);
    });
  }, []);

  const properties = useMemo(() => {
    const props = selected?.detail?.properties;
    if (!props) {
      return [] as Array<[string, string]>;
    }
    return Object.entries(props)
      .filter(([, v]) => v != null && String(v).trim() !== '')
      .map(([k, v]) => [k, formatPropValue(v)] as [string, string]);
  }, [selected]);

  const selectedDrillTarget = useMemo(() => {
    if (!selected) {
      return null;
    }
    return resolveKgNodeQuery(selected);
  }, [selected]);

  const canDrillSelected = Boolean(
    selectedDrillTarget &&
      !isSameKgTarget(selectedDrillTarget, activeTarget) &&
      selected?.id !== data?.center_node_id,
  );

  const trail = useMemo(() => {
    if (!activeTarget) {
      return [] as KgQueryTarget[];
    }
    return [...history, activeTarget];
  }, [history, activeTarget]);

  if (!target && !activeTarget) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={idleDescription}
        className={fillHeight ? styles.emptyBoxFill : styles.emptyBox}
      />
    );
  }

  return (
    <div className={fillHeight ? styles.viewRootFill : styles.viewRoot}>
      {trail.length > 1 || history.length > 0 ? (
        <div className={styles.navBar} aria-label="子图导航">
          <Button
            type="text"
            size="small"
            icon={<ArrowLeftOutlined />}
            disabled={history.length === 0 || loading}
            onClick={goBack}
            className={styles.backBtn}
          >
            返回
          </Button>
          <div className={styles.breadcrumb} role="navigation">
            {trail.map((item, index) => {
              const isLast = index === trail.length - 1;
              const isHistory = index < history.length;
              return (
                <span
                  key={`${targetKey(item)}-${index}`}
                  className={styles.crumbWrap}
                >
                  {index > 0 ? (
                    <span className={styles.crumbSep} aria-hidden>
                      /
                    </span>
                  ) : null}
                  {isLast || !isHistory ? (
                    <span
                      className={
                        isLast ? styles.crumbCurrent : styles.crumbText
                      }
                      title={`${item.entityType} · ${item.vid}`}
                    >
                      {item.label || item.vid}
                    </span>
                  ) : (
                    <button
                      type="button"
                      className={styles.crumbLink}
                      title={`${item.entityType} · ${item.vid}`}
                      disabled={loading}
                      onClick={() => jumpToHistoryIndex(index)}
                    >
                      {item.label || item.vid}
                    </button>
                  )}
                </span>
              );
            })}
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className={fillHeight ? styles.loadingBoxFill : styles.loadingBox}>
          <Spin size="large" tip="正在加载知识图谱…" />
        </div>
      ) : null}

      {!loading && error ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <div className={styles.errorBlock}>
              <div>{error}</div>
              {history.length > 0 ? (
                <Button size="small" onClick={goBack} style={{ marginTop: 12 }}>
                  返回上一层
                </Button>
              ) : null}
            </div>
          }
          className={fillHeight ? styles.emptyBoxFill : styles.emptyBox}
        />
      ) : null}

      {!loading && !error && data ? (
        <div className={fillHeight ? styles.layoutFill : styles.layout}>
          <div className={styles.graphPane}>
            {data.categories.length > 0 ? (
              <div className={styles.legend} aria-label="图例">
                {data.categories.map((c) => (
                  <span key={c.name} className={styles.legendItem}>
                    <i
                      className={styles.legendDot}
                      style={{ background: c.color }}
                    />
                    {c.name}
                  </span>
                ))}
              </div>
            ) : null}

            {data.nodes.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无图谱节点"
                className={styles.emptyBox}
              />
            ) : (
              <ForceGraph
                nodes={data.nodes}
                links={data.links}
                categories={data.categories}
                centerNodeId={data.center_node_id}
                selectedNodeId={selected?.id}
                onSelectNode={onSelectNode}
                onDrillNode={onDrillNode}
              />
            )}

            <Typography.Text className={styles.graphHint}>
              点击子节点进入其子图 · 滚轮缩放 · 拖拽平移
              {data.summary?.node_count != null
                ? ` · ${data.summary.node_count} 节点`
                : ''}
              {data.summary?.link_count != null
                ? ` / ${data.summary.link_count} 关系`
                : ''}
            </Typography.Text>
          </div>

          <aside className={styles.detailPane} aria-label="节点详情">
            {selected ? (
              <>
                <Typography.Text className={styles.detailName}>
                  {selected.name}
                </Typography.Text>
                {selected.category ? (
                  <span className={styles.detailBadge}>{selected.category}</span>
                ) : null}
                {selected.description ? (
                  <Typography.Paragraph className={styles.detailDesc}>
                    {selected.description}
                  </Typography.Paragraph>
                ) : null}

                {canDrillSelected && selectedDrillTarget ? (
                  <Button
                    type="primary"
                    size="small"
                    className={styles.drillBtn}
                    onClick={() => drillToTarget(selectedDrillTarget)}
                  >
                    进入子图
                    <span className={styles.drillBtnMeta}>
                      {selectedDrillTarget.entityType}
                    </span>
                  </Button>
                ) : null}

                {properties.length > 0 ? (
                  <dl className={styles.propList}>
                    {properties.map(([key, value]) => (
                      <div key={key} className={styles.propRow}>
                        <dt>{key}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="该节点暂无属性"
                    className={styles.detailEmpty}
                  />
                )}
              </>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="点击节点查看详情"
                className={styles.detailEmpty}
              />
            )}
          </aside>
        </div>
      ) : null}
    </div>
  );
}
