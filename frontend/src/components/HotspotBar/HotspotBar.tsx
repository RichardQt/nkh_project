import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FireOutlined } from '@ant-design/icons';
import { Button, Drawer, Empty, Modal, Spin, Typography } from 'antd';
import {
  fetchHotspots,
  hotspotCellText,
  hotspotTitle,
} from '../../services/hotspotApi';
import type { HotspotSection } from '../../types/hotspot';
import type { DisplayField, RelatedEntryRow } from '../../types/chat';
import styles from './HotspotBar.module.css';

interface DetailState {
  section: HotspotSection;
  row: RelatedEntryRow;
  title: string;
  index: number;
}

function displayValue(value: string): string {
  return value.trim() || '暂无';
}

function FieldList({
  fields,
  row,
}: {
  fields: DisplayField[];
  row: RelatedEntryRow;
}) {
  const entries = fields
    .map((field) => ({
      key: field.key,
      label: field.label,
      value: hotspotCellText(row, field.key),
    }))
    .filter((item) => item.value);

  if (!entries.length) {
    return (
      <Typography.Text type="secondary" className={styles.emptyHint}>
        暂无字段信息
      </Typography.Text>
    );
  }

  return (
    <dl className={styles.fieldList}>
      {entries.map((item) => (
        <div key={item.key} className={styles.fieldRow}>
          <dt className={styles.fieldLabel}>{item.label}</dt>
          <dd className={styles.fieldValue}>{displayValue(item.value)}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Conversation-detail hotspot entry: gray trigger button above messages,
 * modal vertical lists per module, detail drawer for full fields.
 */
export default function HotspotBar() {
  const [open, setOpen] = useState(false);
  const [sections, setSections] = useState<HotspotSection[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle',
  );
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  /** Prevents duplicate in-flight loads without aborting successful requests. */
  const loadingRef = useRef(false);
  const loadedRef = useRef(false);

  const loadHotspots = useCallback(async (force = false) => {
    if (loadingRef.current) {
      return;
    }
    if (loadedRef.current && !force) {
      return;
    }

    loadingRef.current = true;
    setStatus('loading');
    setErrorMessage('');

    try {
      const data = await fetchHotspots();
      setSections(data.sections);
      if (data.sections.length) {
        loadedRef.current = true;
        setStatus('ready');
      } else {
        loadedRef.current = false;
        setStatus('error');
        setErrorMessage('暂无热点信息');
      }
    } catch (err: unknown) {
      loadedRef.current = false;
      setSections([]);
      setStatus('error');
      setErrorMessage(
        err instanceof Error ? err.message : '热点信息加载失败，请稍后重试',
      );
    } finally {
      loadingRef.current = false;
    }
  }, []);

  // Prefetch when the conversation page mounts (button is visible).
  useEffect(() => {
    void loadHotspots();
  }, [loadHotspots]);

  // If user opens the modal before prefetch finishes / after failure, ensure load.
  useEffect(() => {
    if (open && status !== 'ready' && !loadingRef.current) {
      void loadHotspots(status === 'error');
    }
  }, [open, status, loadHotspots]);

  const allDetailFields = useMemo(() => {
    if (!detail) {
      return [] as DisplayField[];
    }
    const seen = new Set<string>();
    const out: DisplayField[] = [];
    for (const field of [
      ...detail.section.fields,
      ...detail.section.detailFields,
    ]) {
      if (seen.has(field.key)) {
        continue;
      }
      seen.add(field.key);
      out.push(field);
    }
    return out;
  }, [detail]);

  return (
    <>
      <div className={styles.triggerWrap}>
        <button
          type="button"
          className={styles.trigger}
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <FireOutlined className={styles.triggerIcon} aria-hidden />
          热点信息推荐
        </button>
      </div>

      <Modal
        title="热点信息推荐"
        open={open}
        onCancel={() => {
          setOpen(false);
          setDetail(null);
        }}
        footer={null}
        width={560}
        destroyOnHidden
        className={styles.modal}
        styles={{
          body: {
            paddingTop: 8,
            maxHeight: 'min(68vh, 560px)',
            overflowY: 'auto',
          },
        }}
      >
        {status === 'loading' || status === 'idle' ? (
          <div className={styles.loadingState} aria-busy="true">
            <Spin size="small" />
            <Typography.Text type="secondary">加载热点信息…</Typography.Text>
          </div>
        ) : null}

        {status === 'error' ? (
          <div className={styles.errorState}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={errorMessage || '暂无热点信息'}
            />
            <Button type="primary" onClick={() => void loadHotspots(true)}>
              重新加载
            </Button>
          </div>
        ) : null}

        {status === 'ready'
          ? sections.map((section) => (
              <section key={section.key} className={styles.module}>
                <header className={styles.moduleHead}>
                  <Typography.Text className={styles.moduleTitle}>
                    {section.label}
                  </Typography.Text>
                  <span className={styles.moduleCount}>
                    {section.items.length}
                  </span>
                </header>
                <ul className={styles.list} role="list">
                  {section.items.map((row, index) => {
                    const title = hotspotTitle(section, row, index);
                    return (
                      <li
                        key={`${section.key}-${index}-${title}`}
                        className={styles.listItem}
                      >
                        <span className={styles.itemTitle} title={title}>
                          {title}
                        </span>
                        <Button
                          type="link"
                          size="small"
                          className={styles.detailBtn}
                          onClick={() =>
                            setDetail({
                              section,
                              row,
                              title,
                              index,
                            })
                          }
                        >
                          详情
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          : null}
      </Modal>

      <Drawer
        title={
          <div className={styles.detailTitleBlock}>
            <span className={styles.detailName}>{detail?.title ?? '详情'}</span>
            {detail ? (
              <span className={styles.detailBadge}>{detail.section.label}</span>
            ) : null}
          </div>
        }
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        width={420}
        destroyOnHidden
        className={styles.detailDrawer}
      >
        {detail ? (
          <FieldList fields={allDetailFields} row={detail.row} />
        ) : null}
      </Drawer>
    </>
  );
}
