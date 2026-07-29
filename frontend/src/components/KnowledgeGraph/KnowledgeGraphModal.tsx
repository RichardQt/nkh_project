import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Spin, Typography, Empty } from 'antd';
import { queryKnowledgeGraph, KgQueryError } from '../../services/kgQuery';
import type { KgGraphData, KgNode, KgQueryTarget } from '../../types/kg';
import { ForceGraph } from './ForceGraph';
import styles from './KnowledgeGraph.module.css';

export interface KnowledgeGraphModalProps {
  open: boolean;
  target: KgQueryTarget | null;
  onClose: () => void;
}

function formatPropValue(
  value: string | number | boolean | null | undefined,
): string {
  if (value == null || value === '') {
    return '—';
  }
  if (typeof value === 'boolean') {
    return value ? '是' : '否';
  }
  return String(value);
}

export function KnowledgeGraphModal({
  open,
  target,
  onClose,
}: KnowledgeGraphModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<KgGraphData | null>(null);
  const [selected, setSelected] = useState<KgNode | null>(null);

  useEffect(() => {
    if (!open || !target) {
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setData(null);
    setSelected(null);

    queryKnowledgeGraph(target.entityType, target.vid, controller.signal)
      .then((graph) => {
        setData(graph);
        const center =
          graph.nodes.find((n) => n.id === graph.center_node_id) ??
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
  }, [open, target]);

  const onSelectNode = useCallback((node: KgNode) => {
    setSelected(node);
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

  const title = target
    ? `知识图谱 · ${target.label || target.vid}`
    : '知识图谱';

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width="min(1080px, 96vw)"
      destroyOnHidden
      className={styles.kgModal}
      title={
        <div className={styles.modalTitle}>
          <span className={styles.modalTitleMain}>{title}</span>
          {target ? (
            <span className={styles.modalTitleMeta}>
              {target.entityType}
              <span className={styles.dot}>·</span>
              {target.vid}
            </span>
          ) : null}
        </div>
      }
      styles={{
        body: { paddingTop: 8 },
      }}
    >
      {loading ? (
        <div className={styles.loadingBox}>
          <Spin size="large" tip="正在加载知识图谱…" />
        </div>
      ) : null}

      {!loading && error ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={error}
          className={styles.emptyBox}
        />
      ) : null}

      {!loading && !error && data ? (
        <div className={styles.layout}>
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
              />
            )}

            <Typography.Text className={styles.graphHint}>
              滚轮缩放 · 拖拽画布平移 · 点击节点查看详情
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
    </Modal>
  );
}
