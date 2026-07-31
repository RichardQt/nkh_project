import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DeleteOutlined,
  EditOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  PlusOutlined,
  SearchOutlined,
  StopOutlined,
} from '@ant-design/icons';
import {
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  Typography,
  message,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { motion, useReducedMotion } from 'motion/react';
import { useSensitiveWords } from '../../context/SensitiveWordsContext';
import { easeOut } from '../../motion/tokens';
import {
  createSensitiveWord,
  deleteSensitiveWord,
  listSensitiveWordCategories,
  listSensitiveWords,
  updateSensitiveWord,
  type SensitiveWordItem,
} from '../../services/sensitiveWordsApi';
import styles from './SensitiveWordsPage.module.css';

type FormValues = {
  word: string;
  category?: string;
  subcategory?: string;
};

/** Mask a sensitive word for table display (keep length cue, hide content). */
function maskSensitiveWord(word: string): string {
  const text = word.trim();
  if (!text) {
    return '';
  }
  if (text.length === 1) {
    return '*';
  }
  if (text.length === 2) {
    return `${text[0]}*`;
  }
  return `${text[0]}${'*'.repeat(text.length - 2)}${text[text.length - 1]}`;
}

export default function SensitiveWordsPage() {
  const reduceMotion = useReducedMotion();
  const { refresh: refreshLexicon } = useSensitiveWords();
  const [form] = Form.useForm<FormValues>();

  const [keywordDraft, setKeywordDraft] = useState('');
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [categories, setCategories] = useState<string[]>([]);
  const [items, setItems] = useState<SensitiveWordItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SensitiveWordItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(() => new Set());

  const loadCategories = useCallback(async () => {
    try {
      const next = await listSensitiveWordCategories();
      setCategories(next);
    } catch {
      // Non-blocking for the table view.
    }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listSensitiveWords({
        q: keyword,
        category: category ?? '',
        page,
        pageSize,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (error) {
      const text =
        error instanceof Error ? error.message : '加载敏感词失败';
      message.error(text);
    } finally {
      setLoading(false);
    }
  }, [category, keyword, page, pageSize]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (item: SensitiveWordItem) => {
    setEditing(item);
    form.setFieldsValue({
      word: item.word,
      category: item.category || undefined,
      subcategory: item.subcategory || undefined,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = {
        word: values.word.trim(),
        category: values.category?.trim() ?? '',
        subcategory: values.subcategory?.trim() ?? '',
      };
      if (editing) {
        await updateSensitiveWord(editing.id, payload);
        message.success('敏感词已更新');
      } else {
        await createSensitiveWord(payload);
        message.success('敏感词已添加');
      }
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      await Promise.all([loadList(), loadCategories(), refreshLexicon()]);
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        return;
      }
      const text =
        error instanceof Error ? error.message : '保存敏感词失败';
      message.error(text);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: SensitiveWordItem) => {
    try {
      await deleteSensitiveWord(item.id);
      message.success('敏感词已删除');
      if (items.length === 1 && page > 1) {
        setPage((current) => current - 1);
        await Promise.all([loadCategories(), refreshLexicon()]);
      } else {
        await Promise.all([loadList(), loadCategories(), refreshLexicon()]);
      }
    } catch (error) {
      const text =
        error instanceof Error ? error.message : '删除敏感词失败';
      message.error(text);
    }
  };

  const toggleReveal = useCallback((id: string) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const columns: ColumnsType<SensitiveWordItem> = useMemo(
    () => [
      {
        title: '敏感词',
        dataIndex: 'word',
        key: 'word',
        width: 240,
        align: 'center',
        ellipsis: true,
        render: (value: string, record) => {
          const revealed = revealedIds.has(record.id);
          return (
            <div className={styles.wordCellRow}>
              <span
                className={styles.wordCell}
                title={revealed ? value : undefined}
              >
                {revealed ? value : maskSensitiveWord(value)}
              </span>
              <Button
                type="text"
                size="small"
                className={styles.revealButton}
                icon={revealed ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                aria-label={revealed ? '隐藏敏感词' : '显示敏感词'}
                onClick={() => toggleReveal(record.id)}
              />
            </div>
          );
        },
      },
      {
        title: '大类',
        dataIndex: 'category',
        key: 'category',
        align: 'center',
        ellipsis: true,
        render: (value: string) => (
          <span className={styles.metaCell}>{value || '-'}</span>
        ),
      },
      {
        title: '小类',
        dataIndex: 'subcategory',
        key: 'subcategory',
        align: 'center',
        ellipsis: true,
        render: (value: string) => (
          <span className={styles.metaCell}>{value || '-'}</span>
        ),
      },
      {
        title: '更新时间',
        dataIndex: 'updatedAt',
        key: 'updatedAt',
        width: 168,
        align: 'center',
        render: (value: string) => (
          <span className={styles.metaCell}>{value || '-'}</span>
        ),
      },
      {
        title: '操作',
        key: 'actions',
        fixed: 'right',
        width: 148,
        align: 'center',
        render: (_, record) => (
          <div className={styles.actions}>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEdit(record)}
            >
              编辑
            </Button>
            <Popconfirm
              title="删除该敏感词？"
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
              onConfirm={() => {
                void handleDelete(record);
              }}
            >
              <Button
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
              >
                删除
              </Button>
            </Popconfirm>
          </div>
        ),
      },
    ],
    // openEdit/handleDelete close over latest state; columns recreated with list deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, page, revealedIds, toggleReveal],
  );

  const pagination: TablePaginationConfig = {
    current: page,
    pageSize,
    total,
    showSizeChanger: true,
    pageSizeOptions: [20, 50, 100],
    showTotal: (count) => `共 ${count} 条`,
    onChange: (nextPage, nextSize) => {
      setPage(nextPage);
      setPageSize(nextSize);
    },
  };

  return (
    <main className={styles.page}>
      <div className={styles.stage}>
        <motion.header
          className={styles.header}
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            reduceMotion ? { duration: 0 } : { duration: 0.36, ease: easeOut }
          }
        >
          <div className={styles.headerCopy}>
            <Typography.Title level={2} className={styles.title}>
              <StopOutlined style={{ marginRight: 10 }} />
              敏感词配置
            </Typography.Title>
            <Typography.Paragraph className={styles.subtitle}>
              维护发送拦截词库。用户输入包含任一敏感词时，前端将直接拦截并提示更换描述。
            </Typography.Paragraph>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新增敏感词
          </Button>
        </motion.header>

        <motion.div
          className={styles.toolbar}
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reduceMotion ? 0 : 0.3,
            delay: reduceMotion ? 0 : 0.04,
            ease: easeOut,
          }}
        >
          <Input
            allowClear
            className={styles.searchInput}
            prefix={<SearchOutlined />}
            placeholder="搜索敏感词 / 大类 / 小类"
            value={keywordDraft}
            onChange={(event) => setKeywordDraft(event.target.value)}
            onPressEnter={() => {
              setPage(1);
              setKeyword(keywordDraft.trim());
            }}
          />
          <Select
            allowClear
            className={styles.categorySelect}
            placeholder="按大类筛选"
            value={category}
            options={categories.map((item) => ({
              label: item,
              value: item,
            }))}
            onChange={(value) => {
              setPage(1);
              setCategory(value);
            }}
          />
          <Space wrap>
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={() => {
                setPage(1);
                setKeyword(keywordDraft.trim());
              }}
            >
              查询
            </Button>
            <Button
              onClick={() => {
                setKeywordDraft('');
                setKeyword('');
                setCategory(undefined);
                setPage(1);
              }}
            >
              重置
            </Button>
          </Space>
        </motion.div>

        <motion.section
          className={styles.card}
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reduceMotion ? 0 : 0.3,
            delay: reduceMotion ? 0 : 0.08,
            ease: easeOut,
          }}
        >
          {loading && items.length === 0 ? (
            <div className={styles.loadingWrap}>
              <Spin tip="加载敏感词中" />
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <Table<SensitiveWordItem>
                rowKey="id"
                columns={columns}
                dataSource={items}
                loading={loading}
                pagination={pagination}
                scroll={{ x: 860 }}
                size="middle"
              />
            </div>
          )}
        </motion.section>
      </div>

      <Modal
        title={editing ? '编辑敏感词' : '新增敏感词'}
        open={modalOpen}
        onCancel={() => {
          if (!saving) {
            setModalOpen(false);
            setEditing(null);
            form.resetFields();
          }
        }}
        onOk={() => {
          void handleSave();
        }}
        okText="保存"
        cancelText="取消"
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item
            label="敏感词"
            name="word"
            rules={[
              { required: true, message: '请输入敏感词' },
              {
                validator: async (_, value) => {
                  if (typeof value === 'string' && !value.trim()) {
                    throw new Error('敏感词不能为空');
                  }
                },
              },
            ]}
          >
            <Input placeholder="请输入敏感词" maxLength={200} allowClear />
          </Form.Item>
          <Form.Item label="大类" name="category">
            <Input placeholder="可选" maxLength={120} allowClear />
          </Form.Item>
          <Form.Item label="小类" name="subcategory">
            <Input placeholder="可选" maxLength={200} allowClear />
          </Form.Item>
        </Form>
      </Modal>
    </main>
  );
}
