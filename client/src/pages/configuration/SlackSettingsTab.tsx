import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  KeyRound,
  MessageSquare,
  Radio,
  Save,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { getSlackSettings, saveSlackSettings, sendTestSlack } from '../../services/api';
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
import type { SlackCategorySetting } from '../../types';

export default function SlackSettingsTab() {
  const { addToast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ['config', 'slack'], queryFn: getSlackSettings });

  const [botToken, setBotToken] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [categories, setCategories] = useState<SlackCategorySetting[]>([]);
  const [testTo, setTestTo] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [testFeedback, setTestFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  // Seed the form from the server once.
  if (data && !loaded) {
    setEnabled(data.enabled);
    setCategories(data.categories);
    setTestTo(user?.email ?? '');
    setLoaded(true);
  }

  const toggleCategory = (key: string, slackEnabled: boolean) =>
    setCategories((prev) => prev.map((c) => (c.key === key ? { ...c, slackEnabled } : c)));

  const saveMutation = useMutation({
    mutationFn: () =>
      saveSlackSettings({
        botToken: botToken.trim() || null, // blank keeps the stored token
        enabled,
        categories: categories.map((c) => ({ key: c.key, slackEnabled: c.slackEnabled })),
      }),
    onSuccess: (fresh) => {
      queryClient.setQueryData(['config', 'slack'], fresh);
      setCategories(fresh.categories);
      setBotToken('');
      addToast('Slack settings saved successfully.');
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Could not save Slack settings.';
      addToast(message, 'danger');
    },
  });

  const testMutation = useMutation({
    mutationFn: () => sendTestSlack(testTo.trim()),
    onSuccess: (res) => {
      if (res.ok) {
        const msg = `Test message successfully delivered to ${testTo.trim()}.`;
        setTestFeedback({ ok: true, message: msg });
        addToast(msg);
      } else {
        const err = res.error ?? 'Unknown error occurred while sending the Slack message.';
        setTestFeedback({ ok: false, message: err });
        addToast(`Test failed: ${err}`, 'danger');
      }
    },
    onError: () => {
      const err = 'Could not send the test Slack message. Please check server logs and the bot token.';
      setTestFeedback({ ok: false, message: err });
      addToast(err, 'danger');
    },
  });

  if (isLoading) return <SkeletonRows rows={4} label="Loading Slack settings" />;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
      {/* Primary Configuration Column (8 cols on large) */}
      <div className="lg:col-span-8 flex flex-col gap-6">
        <Card>
          <CardHeader>
            <div className="min-w-0">
              <CardTitle asChild>
                <h3 className="flex items-center gap-2">
                  <MessageSquare className="size-5 text-primary" />
                  <span>Slack Bot Configuration</span>
                </h3>
              </CardTitle>
              <CardDescription className="mt-0.5">
                Send interview, evaluation and job-opening notifications as direct messages from your Slack bot.
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
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-[length:var(--text-xs)] font-bold uppercase tracking-wider text-muted-foreground border-b border-line pb-1.5">
                  <KeyRound className="size-3.5 text-primary" />
                  <span>Bot Token</span>
                </div>
                <Field
                  label="Bot User OAuth Token"
                  help={
                    data?.botTokenSet
                      ? 'Token is stored. Leave blank to keep unchanged.'
                      : data?.configFallback
                        ? 'Using the Slack:BotToken value from server configuration until one is saved here.'
                        : 'Paste the Bot User OAuth Token (starts with xoxb-) from your Slack app.'
                  }
                >
                  {(p) => (
                    <PasswordInput
                      {...p}
                      value={botToken}
                      onChange={(e) => setBotToken(e.target.value)}
                      autoComplete="new-password"
                      placeholder={data?.botTokenSet ? '•••••••• (leave blank to keep)' : 'xoxb-...'}
                    />
                  )}
                </Field>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-[length:var(--text-xs)] font-bold uppercase tracking-wider text-muted-foreground border-b border-line pb-1.5">
                  <Bell className="size-3.5 text-primary" />
                  <span>Notification Categories</span>
                </div>
                <p className="text-[length:var(--text-xs)] text-muted-foreground -mt-1">
                  Turn Slack on per notification. These always still appear in the in-app notification bell.
                </p>
                <div className="flex flex-col gap-2">
                  {categories.map((c) => (
                    <div key={c.key} className="rounded-lg border border-border bg-surface-muted/20 p-3">
                      <CheckboxField
                        id={`slack-cat-${c.key}`}
                        label={<span className="font-medium text-foreground">{c.label}</span>}
                        checked={c.slackEnabled}
                        onCheckedChange={(checked) => toggleCategory(c.key, checked)}
                      />
                    </div>
                  ))}
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
        <Card>
          <CardHeader>
            <div className="min-w-0">
              <CardTitle asChild>
                <h4 className="text-[length:var(--text-base)] flex items-center gap-2">
                  <Radio className="size-4 text-primary" />
                  <span>Delivery Control</span>
                </h4>
              </CardTitle>
              <CardDescription>Master switch for Slack DM dispatch.</CardDescription>
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
                id="slack-enabled"
                label={
                  <span className="font-semibold text-foreground">
                    {enabled ? 'Slack Delivery is Active' : 'Slack Delivery is Disabled'}
                  </span>
                }
                description={
                  enabled
                    ? 'DMs are sent for every category enabled below.'
                    : data?.configFallback
                      ? 'This switch only turns off the token saved here. A Slack:BotToken is also set in server configuration, so enabled categories will still send using that token.'
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

        <Card>
          <CardHeader>
            <div className="min-w-0">
              <CardTitle asChild>
                <h4 className="text-[length:var(--text-base)] flex items-center gap-2">
                  <Send className="size-4 text-primary" />
                  <span>Send Test Message</span>
                </h4>
              </CardTitle>
              <CardDescription>Verify the bot token and that this email matches a Slack account.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Field label="Recipient Email Address">
              {(p) => (
                <Input
                  {...p}
                  id="slack-test-to"
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
              {testMutation.isPending ? 'Sending test message…' : 'Send test message'}
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

        <Card className="border-dashed bg-surface-muted/20">
          <CardHeader>
            <div className="min-w-0">
              <CardTitle asChild>
                <h4 className="text-[length:var(--text-sm)] font-semibold flex items-center gap-2">
                  <ShieldCheck className="size-4 text-primary" />
                  <span>Setup Guide</span>
                </h4>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-[length:var(--text-xs)] text-muted-foreground flex flex-col gap-2.5 pt-0">
            <div>
              <strong className="text-foreground">Create a Slack app:</strong>
              <p className="mt-0.5">
                At api.slack.com/apps, create a new app with the scopes <em>chat:write</em>, <em>users:read</em> and{' '}
                <em>users:read.email</em>, then install it to your workspace and copy the Bot User OAuth Token.
              </p>
            </div>
            <div>
              <strong className="text-foreground">How recipients are matched:</strong>
              <p className="mt-0.5">
                The bot looks up each recipient by their Recruitment Gorilla email address, so a user only receives
                a DM if that email also exists in your Slack workspace.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
