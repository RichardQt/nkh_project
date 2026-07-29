import { useState } from 'react';
import { LockOutlined, RobotOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Button, Form, Input, Typography } from 'antd';
import { motion, useReducedMotion } from 'motion/react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { pageVariants, tweenUi } from '../../motion/tokens';
import styles from './LoginPage.module.css';

interface LoginFormValues {
  username: string;
  password: string;
}

export default function LoginPage() {
  const { user, bootstrapping, login } = useAuth();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (bootstrapping) {
    return <div className={styles.page} aria-label="正在验证登录状态" />;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  const onFinish = async (values: LoginFormValues) => {
    setError(null);
    setSubmitting(true);
    try {
      await login(values.username.trim(), values.password);
      navigate('/', { replace: true });
    } catch (err) {
      const message =
        err instanceof Error && err.message.trim()
          ? err.message
          : '登录失败，请稍后重试';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.brandPane} aria-label="产品介绍">
          <div className={styles.brandGlow} aria-hidden="true" />
          <div className={styles.brandContent}>
            <div className={styles.brandMark}>
              <RobotOutlined />
            </div>
            <Typography.Title level={2} className={styles.brandTitle}>
              宁科荟AI赋能创新平台
            </Typography.Title>
            <Typography.Paragraph className={styles.brandLead}>
              专注创新与研发
            </Typography.Paragraph>
          </div>
        </section>

        <section className={styles.formPane}>
          <motion.div
            className={styles.card}
            initial={reduceMotion ? false : 'initial'}
            animate="animate"
            variants={pageVariants}
            transition={tweenUi}
          >
            <div className={styles.cardHeader}>
              <Typography.Title level={3} className={styles.cardTitle}>
                登录
              </Typography.Title>
              <Typography.Text type="secondary" className={styles.cardSub}>
                使用分配的账号进入工作台
              </Typography.Text>
            </div>

            {error ? (
              <Alert
                type="error"
                showIcon
                message={error}
                className={styles.alert}
              />
            ) : null}

            <Form<LoginFormValues>
              layout="vertical"
              requiredMark={false}
              onFinish={onFinish}
              autoComplete="on"
              size="large"
              className={styles.form}
            >
              <Form.Item
                label="用户名"
                name="username"
                rules={[{ required: true, message: '请输入用户名' }]}
              >
                <Input
                  prefix={<UserOutlined className={styles.inputIcon} />}
                  placeholder="请输入用户名"
                  autoComplete="username"
                  maxLength={64}
                />
              </Form.Item>

              <Form.Item
                label="密码"
                name="password"
                rules={[{ required: true, message: '请输入密码' }]}
              >
                <Input.Password
                  prefix={<LockOutlined className={styles.inputIcon} />}
                  placeholder="请输入密码"
                  autoComplete="current-password"
                  maxLength={128}
                />
              </Form.Item>

              <Form.Item className={styles.submitItem}>
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  loading={submitting}
                  className={styles.submitButton}
                >
                  进入工作台
                </Button>
              </Form.Item>
            </Form>
          </motion.div>
        </section>
      </div>
    </div>
  );
}
