import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Mail,
  Radio,
  Save,
  Send,
  Server,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { getEmailSettings, saveEmailSettings, sendTestEmail } from '../../services/api';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../components/ToastStack';
import PasswordInput from '../../components/common/PasswordInput';
import { SkeletonRows } from '../../components/common/Loading';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckboxField, Field } from '@/components/ui/field';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ProviderPreset {
  name: string;
  host: string;
  port: number;
  useStartTls: boolean;
  description: string;
}

const PRESETS: ProviderPreset[] = [
  {
    name: 'Gmail / Google Workspace',
    host: 'smtp.gmail.com',
    port: 587,
    useStartTls: true,
    description: 'Uses smtp.gmail.com with STARTTLS on port 587. Requires a 16-character Google App Password.',
  },
  {
    name: 'Microsoft 365 / Outlook',
    host: 'smtp.office365.com',
    port: 587,
    useStartTls: true,
    description: 'Uses smtp.office365.com with STARTTLS on port 587.',
  },
  {
    name: 'Custom SMTP',
    host: '',
    port: 587,
    useStartTls: true,
    description: 'Custom mail server configuration.',
  },
];

export default function EmailSettingsTab() {
  const { addToast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ['config', 'email'], queryFn: getEmailSettings });

  const [host, setHost] = useState('');
  const [port, setPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState('');
  const [password, setPassword] = useState('');
  const [fromAddress, setFromAddress] = useState('');
  const [fromName, setFromName] = useState('Recruitment Gorilla');
  const [useStartTls, setUseStartTls] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [testFeedback, setTestFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  // Seed the form from the server once.
  if (data && !loaded) {
    setHost(data.host);
    setPort(data.port);
    setSmtpUser(data.user ?? '');
    setFromAddress(data.fromAddress);
    setFromName(data.fromName);
    setUseStartTls(data.useStartTls);
    setEnabled(data.enabled);
    setTestTo(user?.email ?? '');
    setLoaded(true);
  }

  const applyPreset = (p: ProviderPreset) => {
    if (p.host) setHost(p.host);
    setPort(p.port);
    setUseStartTls(p.useStartTls);
    addToast(`Applied ${p.name} presets.`);
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      saveEmailSettings({
        host: host.trim(),
        port,
        user: smtpUser.trim() || null,
        password: password.trim() || null, // blank keeps the stored password
        fromAddress: fromAddress.trim(),
        fromName: fromName.trim() || 'Recruitment Gorilla',
        useStartTls,
        enabled,
      }),
    onSuccess: (fresh) => {
      queryClient.setQueryData(['config', 'email'], fresh);
      setPassword('');
      addToast('Email settings saved successfully.');
    },
    onError: () => addToast('Could not save email settings.', 'danger'),
  });

  const testMutation = useMutation({
    mutationFn: () => sendTestEmail(testTo.trim()),
    onSuccess: (res) => {
      if (res.ok) {
        const msg = `Diagnostic email successfully delivered to ${testTo.trim()}.`;
        setTestFeedback({ ok: true, message: msg });
        addToast(msg);
      } else {
        const err = res.error ?? 'Unknown error occurred while dispatching email.';
        setTestFeedback({ ok: false, message: err });
        addToast(`Test failed: ${err}`, 'danger');
      }
    },
    onError: () => {
      const err = 'Could not send the test email. Please check server logs and credentials.';
      setTestFeedback({ ok: false, message: err });
      addToast(err, 'danger');
    },
  });

  if (isLoading) return <SkeletonRows rows={4} label="Loading email settings" />;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
      {/* Primary Configuration Column (8 cols on large) */}
      <div className="lg:col-span-8 flex flex-col gap-6">
        <Card>
          <CardHeader>
            <div className="min-w-0">
              <CardTitle asChild>
                <h3 className="flex items-center gap-2">
                  <Mail className="size-5 text-primary" />
                  <span>SMTP Server Configuration</span>
                </h3>
              </CardTitle>
              <CardDescription className="mt-0.5">
                Configure your outgoing transactional email server for interview schedules and notifications.
              </CardDescription>
            </div>
            <CardAction>
              <Badge variant={enabled ? 'success' : 'neutral'}>
                {enabled ? 'Delivery Active' : 'Delivery Off'}
              </Badge>
            </CardAction>
          </CardHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate();
            }}
          >
            <CardContent className="flex flex-col gap-6 pt-2">
              {/* Quick Preset Selector */}
              <div className="rounded-lg border border-border/80 bg-surface-muted/30 p-3">
                <div className="flex items-center gap-1.5 text-[length:var(--text-xs)] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  <Sparkles className="size-3.5 text-primary" />
                  <span>Quick Setup Presets</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((p) => {
                    const isActive = p.host && host.toLowerCase().includes(p.host.toLowerCase());
                    return (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => applyPreset(p)}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[length:var(--text-xs)] font-medium transition-all',
                          isActive
                            ? 'bg-primary text-white shadow-xs'
                            : 'bg-surface border border-border text-foreground hover:bg-surface-muted',
                        )}
                      >
                        {p.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 1: Server Connection */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-[length:var(--text-xs)] font-bold uppercase tracking-wider text-muted-foreground border-b border-line pb-1.5">
                  <Server className="size-3.5 text-primary" />
                  <span>Server & Connection</span>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
                  <Field className="sm:col-span-8" label="SMTP Host / Server" required>
                    {(p) => (
                      <Input
                        {...p}
                        value={host}
                        onChange={(e) => setHost(e.target.value)}
                        placeholder="e.g. smtp.gmail.com"
                      />
                    )}
                  </Field>
                  <Field className="sm:col-span-4" label="Port" required>
                    {(p) => (
                      <Input
                        {...p}
                        type="number"
                        value={port}
                        onChange={(e) => setPort(Number(e.target.value))}
                        placeholder="587"
                      />
                    )}
                  </Field>
                </div>
                <CheckboxField
                  id="smtp-starttls"
                  label="Use STARTTLS encryption"
                  description="Standard for port 587. Uncheck if using implicit SSL/TLS on port 465."
                  checked={useStartTls}
                  onCheckedChange={(checked) => setUseStartTls(checked)}
                />
              </div>

              {/* Section 2: Authentication */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-[length:var(--text-xs)] font-bold uppercase tracking-wider text-muted-foreground border-b border-line pb-1.5">
                  <KeyRound className="size-3.5 text-primary" />
                  <span>Authentication</span>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Username / Email">
                    {(p) => (
                      <Input
                        {...p}
                        value={smtpUser}
                        onChange={(e) => setSmtpUser(e.target.value)}
                        placeholder="e.g. you@company.com"
                        autoComplete="off"
                      />
                    )}
                  </Field>
                  <Field
                    label="App Password / Token"
                    help={
                      data?.passwordSet
                        ? 'Password is stored. Leave blank to keep unchanged.'
                        : 'Enter SMTP account or App password.'
                    }
                  >
                    {(p) => (
                      <PasswordInput
                        {...p}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                        placeholder={data?.passwordSet ? '•••••••• (leave blank to keep)' : 'Enter password'}
                      />
                    )}
                  </Field>
                </div>
              </div>

              {/* Section 3: Sender Identity */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-[length:var(--text-xs)] font-bold uppercase tracking-wider text-muted-foreground border-b border-line pb-1.5">
                  <UserCheck className="size-3.5 text-primary" />
                  <span>Sender Identity</span>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="From Email Address" required>
                    {(p) => (
                      <Input
                        {...p}
                        type="email"
                        value={fromAddress}
                        onChange={(e) => setFromAddress(e.target.value)}
                        placeholder="recruitment@yourcompany.com"
                      />
                    )}
                  </Field>
                  <Field label="From Display Name" help="Display name shown in candidates' email clients.">
                    {(p) => (
                      <Input
                        {...p}
                        value={fromName}
                        onChange={(e) => setFromName(e.target.value)}
                        placeholder="Recruitment Gorilla"
                      />
                    )}
                  </Field>
                </div>
              </div>
            </CardContent>

            <CardFooter className="justify-between bg-surface-muted/20">
              <div className="text-[length:var(--text-xs)] text-muted-foreground">
                {data?.updatedAt ? (
                  <span>
                    Last updated: {new Date(data.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                ) : (
                  <span>Save changes to update configuration.</span>
                )}
              </div>
              <Button type="submit" disabled={saveMutation.isPending} className="gap-2">
                <Save className="size-4" />
                {saveMutation.isPending ? 'Saving settings…' : 'Save settings'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>

      {/* Control & Diagnostics Sidebar (4 cols on large) */}
      <div className="lg:col-span-4 flex flex-col gap-6">
        {/* Delivery Master Toggle Card */}
        <Card>
          <CardHeader>
            <div className="min-w-0">
              <CardTitle asChild>
                <h4 className="text-[length:var(--text-base)] flex items-center gap-2">
                  <Radio className="size-4 text-primary" />
                  <span>Delivery Control</span>
                </h4>
              </CardTitle>
              <CardDescription>Master switch for transactional email dispatch.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div
              className={cn(
                'rounded-lg border p-3.5 transition-colors',
                enabled
                  ? 'border-[var(--success-border)] bg-success-muted/30'
                  : 'border-border bg-surface-muted/40',
              )}
            >
              <CheckboxField
                id="smtp-enabled"
                label={
                  <span className="font-semibold text-foreground">
                    {enabled ? 'Email Delivery is Active' : 'Email Delivery is Disabled'}
                  </span>
                }
                description={
                  enabled
                    ? 'Emails are live and automatically sent for candidate interviews and alerts.'
                    : 'Dispatch is paused. Notifications stay strictly within the in-app notification center.'
                }
                checked={enabled}
                onCheckedChange={(checked) => setEnabled(checked)}
              />
            </div>
            <p className="text-[length:var(--text-xs)] text-muted-foreground">
              Remember to click <strong>Save settings</strong> after toggling delivery.
            </p>
          </CardContent>
        </Card>

        {/* Test Email Diagnostics Card */}
        <Card>
          <CardHeader>
            <div className="min-w-0">
              <CardTitle asChild>
                <h4 className="text-[length:var(--text-base)] flex items-center gap-2">
                  <Send className="size-4 text-primary" />
                  <span>Send Test Email</span>
                </h4>
              </CardTitle>
              <CardDescription>Verify your SMTP server connection & credentials.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Field label="Recipient Email Address">
              {(p) => (
                <Input
                  {...p}
                  id="smtp-test-to"
                  type="email"
                  value={testTo}
                  onChange={(e) => {
                    setTestTo(e.target.value);
                    setTestFeedback(null);
                  }}
                  placeholder="admin@example.com"
                />
              )}
            </Field>

            <Button
              type="button"
              variant="outline"
              disabled={testMutation.isPending || !testTo.trim()}
              onClick={() => testMutation.mutate()}
              className="w-full gap-2"
            >
              <Send className="size-4" />
              {testMutation.isPending ? 'Sending test message…' : 'Send test email'}
            </Button>

            <p className="text-[length:var(--text-xs)] text-muted-foreground">
              Sends using the <strong>saved</strong> configuration on the server. If you modified settings on the left, save them first.
            </p>

            {testFeedback && (
              <Alert
                variant={testFeedback.ok ? 'success' : 'danger'}
                className="py-2.5 text-[length:var(--text-xs)]"
              >
                {testFeedback.ok ? (
                  <CheckCircle2 className="size-4 text-success" />
                ) : (
                  <AlertCircle className="size-4 text-danger" />
                )}
                <div className="min-w-0">
                  <AlertTitle className="text-[length:var(--text-xs)] font-semibold">
                    {testFeedback.ok ? 'Test Successful' : 'Delivery Error'}
                  </AlertTitle>
                  <AlertDescription className="text-[length:var(--text-xs)] mt-0.5">
                    {testFeedback.message}
                  </AlertDescription>
                </div>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Security & Setup Guide */}
        <Card className="border-dashed bg-surface-muted/20">
          <CardHeader>
            <div className="min-w-0">
              <CardTitle asChild>
                <h4 className="text-[length:var(--text-sm)] font-semibold flex items-center gap-2">
                  <ShieldCheck className="size-4 text-primary" />
                  <span>Setup Recommendations</span>
                </h4>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-[length:var(--text-xs)] text-muted-foreground flex flex-col gap-2.5 pt-0">
            <div>
              <strong className="text-foreground">Google Workspace / Gmail:</strong>
              <p className="mt-0.5">
                Enable 2-Step Verification and create a 16-character <em>App Password</em> in your Google Account security settings.
              </p>
            </div>
            <div>
              <strong className="text-foreground">Microsoft 365:</strong>
              <p className="mt-0.5">
                Ensure <em>Authenticated SMTP</em> is enabled on the sending mailbox in the M365 Admin Center.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
