import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CaretDownOutlined,
  CaretRightOutlined,
  DeleteOutlined,
  EditOutlined,
  MoreOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import {
  Dropdown,
  Empty,
  Input,
  Modal,
  Spin,
  Typography,
  message,
} from 'antd';
import {
  CONVERSATIONS_CHANGED_EVENT,
  conversationPath,
  deleteConversation,
  groupConversationsByRecency,
  listConversations,
  renameConversation,
} from '../../services/conversationApi';
import type {
  ConversationSummary,
  HistoryGroupKey,
} from '../../types/conversation';
import styles from './ConversationHistory.module.css';

interface ConversationHistoryProps {
  activeConversationId?: string | null;
  onSelect: (item: ConversationSummary) => void;
  /** Called after a conversation is deleted (e.g. leave the page if it was active). */
  onDeleted?: (id: string) => void;
}

interface MenuAnchor {
  top: number;
  left: number;
}

/** Default: expand today; collapse yesterday / earlier to free sidebar space. */
const DEFAULT_COLLAPSED: Record<HistoryGroupKey, boolean> = {
  today: false,
  yesterday: true,
  earlier: true,
};

const MENU_WIDTH = 120;
const MENU_GAP = 4;

function anchorFromButton(button: HTMLElement): MenuAnchor {
  const rect = button.getBoundingClientRect();
  const left = Math.min(
    Math.max(8, rect.right - MENU_WIDTH),
    Math.max(8, window.innerWidth - MENU_WIDTH - 8),
  );
  const top = Math.min(rect.bottom + MENU_GAP, window.innerHeight - 8);
  return { top, left };
}

export default function ConversationHistory({
  activeConversationId,
  onSelect,
  onDeleted,
}: ConversationHistoryProps) {
  const [items, setItems] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor | null>(null);
  const [sectionCollapsed, setSectionCollapsed] = useState(false);
  const [collapsedByKey, setCollapsedByKey] = useState(DEFAULT_COLLAPSED);

  const [renameTarget, setRenameTarget] = useState<ConversationSummary | null>(
    null,
  );
  const [renameValue, setRenameValue] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ConversationSummary | null>(
    null,
  );
  const [deleteSaving, setDeleteSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const next = await listConversations();
      setItems(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载历史失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onChanged = () => {
      void load();
    };
    window.addEventListener(CONVERSATIONS_CHANGED_EVENT, onChanged);
    return () => {
      window.removeEventListener(CONVERSATIONS_CHANGED_EVENT, onChanged);
    };
  }, [load]);

  const groups = useMemo(() => groupConversationsByRecency(items), [items]);

  // Keep the section and group that hold the active conversation expanded.
  useEffect(() => {
    if (!activeConversationId) {
      return;
    }
    const activeGroup = groups.find((group) =>
      group.items.some((item) => item.id === activeConversationId),
    );
    if (!activeGroup) {
      return;
    }
    setSectionCollapsed(false);
    setCollapsedByKey((prev) => {
      if (!prev[activeGroup.key]) {
        return prev;
      }
      return { ...prev, [activeGroup.key]: false };
    });
  }, [activeConversationId, groups]);

  const toggleSection = useCallback(() => {
    setSectionCollapsed((prev) => !prev);
  }, []);

  const toggleGroup = useCallback((key: HistoryGroupKey) => {
    setCollapsedByKey((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const closeMenu = useCallback(() => {
    setMenuOpenId(null);
    setMenuAnchor(null);
  }, []);

  const openRename = useCallback(
    (item: ConversationSummary) => {
      closeMenu();
      setRenameTarget(item);
      setRenameValue(item.title);
    },
    [closeMenu],
  );

  const openDelete = useCallback(
    (item: ConversationSummary) => {
      closeMenu();
      setDeleteTarget(item);
    },
    [closeMenu],
  );

  useEffect(() => {
    if (!menuOpenId) {
      return;
    }
    const onViewportChange = () => {
      closeMenu();
    };
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    return () => {
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    };
  }, [menuOpenId, closeMenu]);

  const handleRenameOk = useCallback(async () => {
    if (!renameTarget) {
      return;
    }
    const nextTitle = renameValue.trim();
    if (!nextTitle) {
      message.warning('标题不能为空');
      return;
    }
    if (nextTitle === renameTarget.title) {
      setRenameTarget(null);
      return;
    }

    setRenameSaving(true);
    try {
      const updated = await renameConversation(renameTarget.id, nextTitle);
      setItems((prev) =>
        prev.map((item) =>
          item.id === updated.id ? { ...item, title: updated.title } : item,
        ),
      );
      setRenameTarget(null);
      message.success('已重命名');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '重命名失败');
    } finally {
      setRenameSaving(false);
    }
  }, [renameTarget, renameValue]);

  const handleDeleteOk = useCallback(async () => {
    if (!deleteTarget) {
      return;
    }
    setDeleteSaving(true);
    try {
      const id = deleteTarget.id;
      await deleteConversation(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      setDeleteTarget(null);
      message.success('已删除');
      onDeleted?.(id);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeleteSaving(false);
    }
  }, [deleteTarget, onDeleted]);

  const menuItemsFor = useCallback(
    (item: ConversationSummary): MenuProps['items'] => [
      {
        key: 'rename',
        icon: <EditOutlined />,
        label: '重命名',
        onClick: ({ domEvent }) => {
          domEvent.stopPropagation();
          openRename(item);
        },
      },
      {
        key: 'delete',
        icon: <DeleteOutlined />,
        label: '删除',
        danger: true,
        onClick: ({ domEvent }) => {
          domEvent.stopPropagation();
          openDelete(item);
        },
      },
    ],
    [openDelete, openRename],
  );

  if (loading && items.length === 0) {
    return (
      <div className={styles.root} aria-label="历史对话">
        <button
          type="button"
          className={styles.sectionToggle}
          onClick={toggleSection}
          aria-expanded={!sectionCollapsed}
          aria-controls="history-section-panel"
        >
          <span className={styles.groupToggleIcon} aria-hidden="true">
            {sectionCollapsed ? <CaretRightOutlined /> : <CaretDownOutlined />}
          </span>
          <Typography.Text className={styles.headerTitle}>
            历史对话
          </Typography.Text>
        </button>
        {!sectionCollapsed ? (
          <div id="history-section-panel" className={styles.loading}>
            <Spin size="small" />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={styles.root} aria-label="历史对话">
      <button
        type="button"
        className={styles.sectionToggle}
        onClick={toggleSection}
        aria-expanded={!sectionCollapsed}
        aria-controls="history-section-panel"
      >
        <span className={styles.groupToggleIcon} aria-hidden="true">
          {sectionCollapsed ? <CaretRightOutlined /> : <CaretDownOutlined />}
        </span>
        <Typography.Text className={styles.headerTitle}>历史对话</Typography.Text>
        {items.length > 0 ? (
          <span className={styles.groupCount}>{items.length}</span>
        ) : null}
      </button>

      {!sectionCollapsed ? (
        <div id="history-section-panel" className={styles.sectionBody}>
          {error ? (
            <Typography.Text type="danger" className={styles.errorText}>
              {error}
            </Typography.Text>
          ) : null}

          {!error && groups.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无历史对话"
              className={styles.empty}
            />
          ) : null}

          <div className={styles.scroll}>
            {groups.map((group) => {
              const collapsed = collapsedByKey[group.key];
              const panelId = `history-group-${group.key}`;
              return (
                <section key={group.key} className={styles.group}>
                  <button
                    type="button"
                    className={styles.groupToggle}
                    onClick={() => toggleGroup(group.key)}
                    aria-expanded={!collapsed}
                    aria-controls={panelId}
                  >
                    <span className={styles.groupToggleIcon} aria-hidden="true">
                      {collapsed ? (
                        <CaretRightOutlined />
                      ) : (
                        <CaretDownOutlined />
                      )}
                    </span>
                    <Typography.Text className={styles.groupLabel}>
                      {group.label}
                    </Typography.Text>
                    <span className={styles.groupCount}>
                      {group.items.length}
                    </span>
                  </button>
                  {!collapsed ? (
                    <ul id={panelId} className={styles.list}>
                      {group.items.map((item) => {
                        const active = item.id === activeConversationId;
                        const menuOpen = menuOpenId === item.id;
                        return (
                          <li key={item.id}>
                            <div
                              className={`${styles.itemRow} ${active ? styles.itemRowActive : ''} ${menuOpen ? styles.itemRowMenuOpen : ''}`}
                            >
                              <button
                                type="button"
                                className={styles.itemMain}
                                onClick={() => onSelect(item)}
                                title={item.title}
                                aria-current={active ? 'page' : undefined}
                                data-path={conversationPath(item)}
                              >
                                <span className={styles.itemTitle}>
                                  {item.title}
                                </span>
                              </button>

                              <Dropdown
                                menu={{ items: menuItemsFor(item) }}
                                trigger={['click']}
                                placement="bottomRight"
                                open={menuOpen}
                                destroyOnHidden
                                getPopupContainer={() => document.body}
                                classNames={{ root: styles.menuPopup }}
                                styles={
                                  menuOpen && menuAnchor
                                    ? {
                                        root: {
                                          // CSS vars win over antd/rc-trigger inline align styles.
                                          ['--history-menu-top' as string]:
                                            `${menuAnchor.top}px`,
                                          ['--history-menu-left' as string]:
                                            `${menuAnchor.left}px`,
                                        },
                                      }
                                    : undefined
                                }
                                onOpenChange={(open) => {
                                  if (!open) {
                                    closeMenu();
                                  }
                                }}
                              >
                                <button
                                  type="button"
                                  className={styles.moreButton}
                                  aria-label={`更多操作：${item.title}`}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    if (menuOpenId === item.id) {
                                      closeMenu();
                                      return;
                                    }
                                    setMenuAnchor(
                                      anchorFromButton(event.currentTarget),
                                    );
                                    setMenuOpenId(item.id);
                                  }}
                                >
                                  <MoreOutlined />
                                </button>
                              </Dropdown>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </section>
              );
            })}
          </div>
        </div>
      ) : null}

      <Modal
        title="重命名对话"
        open={Boolean(renameTarget)}
        onOk={() => {
          void handleRenameOk();
        }}
        onCancel={() => {
          if (!renameSaving) {
            setRenameTarget(null);
          }
        }}
        confirmLoading={renameSaving}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
      >
        <Input
          value={renameValue}
          onChange={(event) => setRenameValue(event.target.value)}
          maxLength={200}
          placeholder="输入对话标题"
          autoFocus
          onPressEnter={() => {
            void handleRenameOk();
          }}
        />
      </Modal>

      <Modal
        title="删除对话"
        open={Boolean(deleteTarget)}
        onOk={() => {
          void handleDeleteOk();
        }}
        onCancel={() => {
          if (!deleteSaving) {
            setDeleteTarget(null);
          }
        }}
        confirmLoading={deleteSaving}
        okText="删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
        destroyOnHidden
      >
        <Typography.Paragraph className={styles.confirmText}>
          确定删除「{deleteTarget?.title ?? ''}」吗？删除后无法恢复。
        </Typography.Paragraph>
      </Modal>
    </div>
  );
}
