import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  EditOutlined,
  IdcardOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import {
  Button,
  Checkbox,
  Empty,
  Form,
  Input,
  Segmented,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import { motion, useReducedMotion } from 'motion/react';
import { easeOut } from '../../motion/tokens';
import {
  fetchUserProfile,
  saveUserProfile,
} from '../../services/userProfileApi';
import type {
  PersonaRoleType,
  UserProfile,
  UserProfilePayload,
} from '../../types/userProfile';
import {
  FOCUS_AREA_SUGGESTIONS,
  PERSONA_ROLE_OPTIONS,
  PERSONA_SCENE_OPTIONS,
  emptyUserProfile,
  personaRoleLabel,
} from '../../types/userProfile';
import styles from './UserPersonaPage.module.css';

interface ProfileFormValues {
  roleType: PersonaRoleType | '';
  needs: string;
  focusAreas: string[];
  preferredScenes: string[];
  memoryNotes: string;
}

function toFormValues(profile: UserProfile): ProfileFormValues {
  return {
    roleType: profile.roleType,
    needs: profile.needs,
    focusAreas: [...profile.focusAreas],
    preferredScenes: [...profile.preferredScenes],
    memoryNotes: profile.memoryNotes,
  };
}

function formatUpdatedAt(value: string): string {
  if (!value) {
    return '尚未保存';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function sceneLabel(value: string): string {
  return (
    PERSONA_SCENE_OPTIONS.find((item) => item.value === value)?.label ?? value
  );
}

export default function UserPersonaPage() {
  const [form] = Form.useForm<ProfileFormValues>();
  const [profile, setProfile] = useState<UserProfile>(emptyUserProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const reduceMotion = useReducedMotion();

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchUserProfile();
      setProfile(data);
      form.setFieldsValue(toFormValues(data));
    } catch (error) {
      const text =
        error instanceof Error ? error.message : '加载用户画像失败';
      message.error(text);
      setProfile(emptyUserProfile());
      form.setFieldsValue(toFormValues(emptyUserProfile()));
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const roleDescription = useMemo(() => {
    if (!profile.roleType) {
      return '选择身份后，系统可按角色偏好组织记忆与推荐。';
    }
    return (
      PERSONA_ROLE_OPTIONS.find((item) => item.value === profile.roleType)
        ?.description ?? ''
    );
  }, [profile.roleType]);

  const startEdit = () => {
    form.setFieldsValue(toFormValues(profile));
    setEditing(true);
  };

  const cancelEdit = () => {
    form.setFieldsValue(toFormValues(profile));
    setEditing(false);
  };

  const onSave = async () => {
    let values: ProfileFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    const payload: UserProfilePayload = {
      roleType: values.roleType || '',
      needs: values.needs?.trim() ?? '',
      focusAreas: (values.focusAreas ?? [])
        .map((item) => item.trim())
        .filter(Boolean),
      preferredScenes: values.preferredScenes ?? [],
      memoryNotes: values.memoryNotes?.trim() ?? '',
    };

    setSaving(true);
    try {
      const saved = await saveUserProfile(payload);
      setProfile(saved);
      form.setFieldsValue(toFormValues(saved));
      setEditing(false);
      message.success('用户画像已保存');
    } catch (error) {
      const text =
        error instanceof Error ? error.message : '保存用户画像失败';
      message.error(text);
    } finally {
      setSaving(false);
    }
  };

  const motionProps = (delay = 0) =>
    reduceMotion
      ? { initial: false as const, animate: { opacity: 1, y: 0 } }
      : {
          initial: { opacity: 0, y: 10 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.34, delay, ease: easeOut },
        };

  return (
    <main className={styles.page}>
      <div className={styles.stage}>
        <motion.header className={styles.header} {...motionProps(0)}>
          <div className={styles.headerCopy}>
            <Typography.Title level={2} className={styles.title}>
              用户画像
            </Typography.Title>
            <Typography.Paragraph className={styles.subtitle}>
              记录角色、需求与偏好记忆，帮助智能助手更贴合你的使用场景。
            </Typography.Paragraph>
          </div>
          <div className={styles.headerActions}>
            {editing ? (
              <Space size={8} wrap>
                <Button onClick={cancelEdit} disabled={saving}>
                  取消
                </Button>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  loading={saving}
                  onClick={() => void onSave()}
                >
                  保存
                </Button>
              </Space>
            ) : (
              <Button
                type="primary"
                icon={<EditOutlined />}
                onClick={startEdit}
                disabled={loading}
              >
                编辑
              </Button>
            )}
          </div>
        </motion.header>

        {loading ? (
          <div className={styles.loadingState} aria-label="加载中">
            <Spin />
          </div>
        ) : editing ? (
          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            className={styles.editForm}
          >
            <motion.section
              className={styles.identityCard}
              aria-label="用户角色"
              {...motionProps(0.04)}
            >
              <div className={styles.identityHead}>
                <span className={styles.identityIcon} aria-hidden="true">
                  <IdcardOutlined />
                </span>
                <div className={styles.identityCopy}>
                  <Typography.Text className={styles.sectionLabel}>
                    用户角色
                  </Typography.Text>
                  <Typography.Text className={styles.identityHint}>
                    三选一，用于区分高校、企业与技术经理人视角
                  </Typography.Text>
                </div>
              </div>
              <Form.Item name="roleType" className={styles.roleFormItem}>
                <Segmented
                  block
                  options={PERSONA_ROLE_OPTIONS.map((item) => ({
                    label: item.label,
                    value: item.value,
                  }))}
                  className={styles.roleSegmented}
                />
              </Form.Item>
            </motion.section>

            <motion.section
              className={styles.formCard}
              aria-label="画像详情"
              {...motionProps(0.08)}
            >
              <div className={styles.formGrid}>
                <Form.Item
                  label="用户需求"
                  name="needs"
                  className={styles.formItem}
                  rules={[
                    {
                      max: 4000,
                      message: '用户需求不能超过 4000 字',
                    },
                  ]}
                >
                  <Input.TextArea
                    rows={4}
                    maxLength={4000}
                    showCount
                    placeholder="描述你希望系统记住的核心诉求，例如成果转化、技术对接、政策匹配等"
                  />
                </Form.Item>

                <Form.Item
                  label="关注领域"
                  name="focusAreas"
                  className={styles.formItem}
                >
                  <Select
                    mode="tags"
                    tokenSeparators={[',', '，', ';', '；']}
                    placeholder="输入或选择关注领域，回车添加"
                    options={FOCUS_AREA_SUGGESTIONS.map((value) => ({
                      value,
                      label: value,
                    }))}
                    maxTagCount="responsive"
                    getPopupContainer={() => document.body}
                    popupMatchSelectWidth={false}
                  />
                </Form.Item>

                <Form.Item
                  label="常用场景"
                  name="preferredScenes"
                  className={styles.formItem}
                >
                  <Checkbox.Group className={styles.sceneGroup}>
                    {PERSONA_SCENE_OPTIONS.map((item) => (
                      <Checkbox key={item.value} value={item.value}>
                        {item.label}
                      </Checkbox>
                    ))}
                  </Checkbox.Group>
                </Form.Item>

                <Form.Item
                  label="备注记忆"
                  name="memoryNotes"
                  className={styles.formItem}
                  rules={[
                    {
                      max: 4000,
                      message: '备注记忆不能超过 4000 字',
                    },
                  ]}
                >
                  <Input.TextArea
                    rows={4}
                    maxLength={4000}
                    showCount
                    placeholder="补充单位、合作偏好、免打扰时段等系统应长期记住的信息"
                  />
                </Form.Item>
              </div>

              <div className={styles.metaRow}>
                <Typography.Text type="secondary" className={styles.metaText}>
                  最近更新：{formatUpdatedAt(profile.updatedAt)}
                </Typography.Text>
              </div>
            </motion.section>
          </Form>
        ) : (
          <>
            <motion.section
              className={styles.identityCard}
              aria-label="用户角色"
              {...motionProps(0.04)}
            >
              <div className={styles.identityHead}>
                <span className={styles.identityIcon} aria-hidden="true">
                  <IdcardOutlined />
                </span>
                <div className={styles.identityCopy}>
                  <Typography.Text className={styles.sectionLabel}>
                    用户角色
                  </Typography.Text>
                  <Typography.Text className={styles.identityHint}>
                    {roleDescription}
                  </Typography.Text>
                </div>
                <Tag className={styles.roleTag} color="processing">
                  {personaRoleLabel(profile.roleType)}
                </Tag>
              </div>
              <div className={styles.roleReadonly}>
                {PERSONA_ROLE_OPTIONS.map((item) => {
                  const active = profile.roleType === item.value;
                  return (
                    <div
                      key={item.value}
                      className={`${styles.roleChip} ${active ? styles.roleChipActive : ''}`}
                    >
                      <span className={styles.roleChipLabel}>
                        {item.label}
                      </span>
                      <span className={styles.roleChipDesc}>
                        {item.description}
                      </span>
                    </div>
                  );
                })}
              </div>
            </motion.section>

            <motion.section
              className={styles.formCard}
              aria-label="画像详情"
              {...motionProps(0.08)}
            >
              <div className={styles.readonlyGrid}>
                <div className={styles.readonlyBlock}>
                  <Typography.Text className={styles.sectionLabel}>
                    用户需求
                  </Typography.Text>
                  {profile.needs ? (
                    <Typography.Paragraph className={styles.readonlyBody}>
                      {profile.needs}
                    </Typography.Paragraph>
                  ) : (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="尚未填写需求"
                      className={styles.inlineEmpty}
                    />
                  )}
                </div>

                <div className={styles.readonlyBlock}>
                  <Typography.Text className={styles.sectionLabel}>
                    关注领域
                  </Typography.Text>
                  {profile.focusAreas.length > 0 ? (
                    <div className={styles.tagRow}>
                      {profile.focusAreas.map((item) => (
                        <Tag key={item} className={styles.focusTag}>
                          {item}
                        </Tag>
                      ))}
                    </div>
                  ) : (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="尚未添加关注领域"
                      className={styles.inlineEmpty}
                    />
                  )}
                </div>

                <div className={styles.readonlyBlock}>
                  <Typography.Text className={styles.sectionLabel}>
                    常用场景
                  </Typography.Text>
                  {profile.preferredScenes.length > 0 ? (
                    <div className={styles.tagRow}>
                      {profile.preferredScenes.map((item) => (
                        <Tag key={item} className={styles.sceneTag}>
                          {sceneLabel(item)}
                        </Tag>
                      ))}
                    </div>
                  ) : (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="尚未选择常用场景"
                      className={styles.inlineEmpty}
                    />
                  )}
                </div>

                <div className={styles.readonlyBlock}>
                  <Typography.Text className={styles.sectionLabel}>
                    备注记忆
                  </Typography.Text>
                  {profile.memoryNotes ? (
                    <Typography.Paragraph className={styles.readonlyBody}>
                      {profile.memoryNotes}
                    </Typography.Paragraph>
                  ) : (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="尚未添加备注记忆"
                      className={styles.inlineEmpty}
                    />
                  )}
                </div>
              </div>

              <div className={styles.metaRow}>
                <Typography.Text type="secondary" className={styles.metaText}>
                  最近更新：{formatUpdatedAt(profile.updatedAt)}
                </Typography.Text>
              </div>
            </motion.section>
          </>
        )}
      </div>
    </main>
  );
}
