import { useCallback, useMemo, useState } from 'react';
import {
  DatabaseOutlined,
  EyeOutlined,
  PlusOutlined,
  SearchOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import {
  Button,
  Drawer,
  Flex,
  Input,
  Space,
  Table,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { motion, useReducedMotion } from 'motion/react';
import { useSearchParams } from 'react-router-dom';
import {
  DEFAULT_KB_KEY,
  KB_LIBRARIES,
  getKbLibrary,
  type KbLibraryMeta,
} from '../../data/knowledgeBase/catalog';
import {
  KB_MOCK_ROWS,
  type KbRow,
} from '../../data/knowledgeBase/mockData';
import { easeOut } from '../../motion/tokens';
import styles from './KnowledgeBasePage.module.css';

function cellText(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  return String(value);
}

function buildColumns(
  library: KbLibraryMeta,
  onDetail: (row: KbRow) => void,
): ColumnsType<KbRow> {
  const primary = library.primaryField;
  const dataCols: ColumnsType<KbRow> = library.columns.map((col, index) => {
    const isPrimary = col.key === primary;
    return {
      title: col.title,
      dataIndex: col.key,
      key: col.key,
      ellipsis: col.ellipsis !== false,
      width: isPrimary ? 200 : col.longText ? 220 : 140,
      fixed: isPrimary || index === 0 ? ('left' as const) : undefined,
      render: (value: unknown) => (
        <span className={isPrimary ? styles.primaryCell : undefined}>
          {cellText(value)}
        </span>
      ),
    };
  });

  dataCols.push({
    title: '操作',
    key: '__actions',
    fixed: 'right',
    width: 88,
    render: (_, record) => (
      <Button
        type="link"
        size="small"
        icon={<EyeOutlined />}
        className={styles.detailBtn}
        onClick={() => onDetail(record)}
      >
        详情
      </Button>
    ),
  });

  return dataCols;
}

export default function KnowledgeBasePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const reduceMotion = useReducedMotion();
  const [keyword, setKeyword] = useState('');
  const [detailRow, setDetailRow] = useState<KbRow | null>(null);

  const activeKey = useMemo(() => {
    const fromUrl = searchParams.get('lib')?.trim() ?? '';
    if (fromUrl && getKbLibrary(fromUrl)) {
      return fromUrl;
    }
    return DEFAULT_KB_KEY;
  }, [searchParams]);

  const library = useMemo(
    () => getKbLibrary(activeKey) ?? KB_LIBRARIES[0],
    [activeKey],
  );

  const rows = useMemo(
    () => KB_MOCK_ROWS[library.key] ?? [],
    [library.key],
  );

  const filteredRows = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) {
      return rows;
    }
    return rows.filter((row) => {
      const primary = cellText(row[library.primaryField]).toLowerCase();
      if (primary.includes(q)) {
        return true;
      }
      return library.columns.some((col) =>
        cellText(row[col.key]).toLowerCase().includes(q),
      );
    });
  }, [keyword, library, rows]);

  const selectLibrary = useCallback(
    (key: string) => {
      setKeyword('');
      setDetailRow(null);
      setSearchParams(key === DEFAULT_KB_KEY ? {} : { lib: key }, {
        replace: true,
      });
    },
    [setSearchParams],
  );

  const columns = useMemo(
    () => buildColumns(library, setDetailRow),
    [library],
  );

  const detailTitle = useMemo(() => {
    if (!detailRow) {
      return '条目详情';
    }
    const name = cellText(detailRow[library.primaryField]);
    return name === '-' ? '条目详情' : name;
  }, [detailRow, library.primaryField]);

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
              知识库设置
            </Typography.Title>
            <Typography.Paragraph className={styles.subtitle}>
              浏览各领域知识条目（演示数据）。新增与上传为预览操作，暂不写入后端。
            </Typography.Paragraph>
          </div>
        </motion.header>

        <motion.div
          className={styles.workspace}
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reduceMotion ? 0 : 0.32,
            delay: reduceMotion ? 0 : 0.04,
            ease: easeOut,
          }}
        >
          <aside className={styles.libSidebar} aria-label="知识库列表">
            <div className={styles.libSidebarHead}>
              <DatabaseOutlined className={styles.libSidebarIcon} />
              <span>知识库</span>
            </div>
            <nav className={styles.libList}>
              {KB_LIBRARIES.map((lib) => {
                const active = lib.key === library.key;
                return (
                  <button
                    key={lib.key}
                    type="button"
                    className={`${styles.libItem} ${active ? styles.libItemActive : ''}`}
                    onClick={() => selectLibrary(lib.key)}
                    aria-current={active ? 'page' : undefined}
                  >
                    <span className={styles.libItemLabel}>{lib.label}</span>
                    <span className={styles.libItemCount}>
                      {(KB_MOCK_ROWS[lib.key] ?? []).length}
                    </span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <section className={styles.mainPanel} aria-label={library.label}>
            <Flex
              className={styles.toolbar}
              justify="space-between"
              align="center"
              gap={12}
              wrap
            >
              <div className={styles.panelTitleBlock}>
                <Typography.Text className={styles.panelTitle}>
                  {library.label}
                </Typography.Text>
                <Typography.Text type="secondary" className={styles.panelMeta}>
                  共 {filteredRows.length} 条
                  {keyword.trim() ? `（筛选自 ${rows.length} 条）` : ''}
                </Typography.Text>
              </div>

              <Space size={8} wrap className={styles.toolbarActions}>
                <Input
                  allowClear
                  prefix={<SearchOutlined />}
                  placeholder="搜索名称或字段"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className={styles.searchInput}
                />
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() =>
                    message.info('演示环境：新增功能即将开放')
                  }
                >
                  新增
                </Button>
                <Button
                  icon={<UploadOutlined />}
                  onClick={() =>
                    message.info('演示环境：Excel 上传功能即将开放')
                  }
                >
                  上传
                </Button>
              </Space>
            </Flex>

            <div className={styles.tableWrap}>
              <Table<KbRow>
                size="middle"
                rowKey="__rowId"
                columns={columns}
                dataSource={filteredRows}
                pagination={{
                  pageSize: 10,
                  showSizeChanger: false,
                  showTotal: (total) => `共 ${total} 条`,
                }}
                scroll={{ x: 'max-content', y: 'calc(100vh - 320px)' }}
                locale={{ emptyText: '暂无数据' }}
              />
            </div>
          </section>
        </motion.div>
      </div>

      <Drawer
        title={detailTitle}
        open={Boolean(detailRow)}
        onClose={() => setDetailRow(null)}
        width={480}
        destroyOnHidden
      >
        {detailRow ? (
          <dl className={styles.detailList}>
            {library.columns.map((col) => (
              <div key={col.key} className={styles.detailRow}>
                <dt>{col.title}</dt>
                <dd className={col.longText ? styles.detailLong : undefined}>
                  {cellText(detailRow[col.key])}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </Drawer>
    </main>
  );
}
