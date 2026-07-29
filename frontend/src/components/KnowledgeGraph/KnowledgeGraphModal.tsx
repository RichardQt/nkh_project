import { useState } from 'react';
import { Modal } from 'antd';
import type { KgQueryTarget } from '../../types/kg';
import { KnowledgeGraphView } from './KnowledgeGraphView';
import styles from './KnowledgeGraph.module.css';

export interface KnowledgeGraphModalProps {
  open: boolean;
  target: KgQueryTarget | null;
  onClose: () => void;
}

export function KnowledgeGraphModal({
  open,
  target,
  onClose,
}: KnowledgeGraphModalProps) {
  const [activeTarget, setActiveTarget] = useState<KgQueryTarget | null>(null);
  const display = activeTarget ?? target;
  const title = display
    ? `知识图谱 · ${display.label || display.vid}`
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
          {display ? (
            <span className={styles.modalTitleMeta}>
              {display.entityType}
              <span className={styles.dot}>·</span>
              {display.vid}
            </span>
          ) : null}
        </div>
      }
      styles={{
        body: { paddingTop: 8 },
      }}
      afterOpenChange={(visible) => {
        if (!visible) {
          setActiveTarget(null);
        }
      }}
    >
      {open ? (
        <KnowledgeGraphView
          target={target}
          onActiveTargetChange={setActiveTarget}
        />
      ) : null}
    </Modal>
  );
}
