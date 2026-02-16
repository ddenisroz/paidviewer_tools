import React, { useState } from 'react';

import { AlertCircle, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/context/AuthContext';
import { useIntegrations } from '@/context/IntegrationsContext';
import { useCommands, useCreateCommandOverride } from '@/queries/commands/commandsQueries';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Switch } from '@/shared/components/ui/switch';

import PageWrapper from '../shared/components/PageWrapper';

const AnalyticsPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { integrations } = useIntegrations();
  const { data: commandsData } = useCommands({
    enabled: !!isAuthenticated && (integrations?.twitch?.enabled || integrations?.vk?.enabled),
  });
  const createOverrideMutation = useCreateCommandOverride();

  const [isSaving, setIsSaving] = useState(false);

  if (!isAuthenticated) {
    return (
      <PageWrapper title="?????????? ?????">
        <Card className="card-glass border-border">
          <CardContent className="pt-12 pb-12 flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
              <AlertCircle className="w-10 h-10 text-muted-foreground" />
            </div>
            <div className="space-y-2 max-w-md">
              <h3 className="text-xl font-semibold text-foreground">????? ???????????</h3>
              <p className="text-muted-foreground text-sm">
                ?????? ???????? ?????? ??? ???????????? ?????????? (Twitch ??? VK Live).
              </p>
            </div>
            <Button onClick={() => navigate('/login')} className="gap-2">
              <Settings className="w-4 h-4" />
              ??????? ? ?????
            </Button>
          </CardContent>
        </Card>
      </PageWrapper>
    );
  }

  const basicCommands = commandsData?.basic_commands || [];
  const analyzeCommand = basicCommands.find((cmd) => cmd.name === 'analyze');
  const hasPlatforms = !!(integrations?.twitch?.enabled || integrations?.vk?.enabled);

  const currentAlias = analyzeCommand?.alias || '';
  const isEnabled = analyzeCommand?.enabled ?? false;

  const handleToggle = async (enabled: boolean) => {
    if (!analyzeCommand) return;
    setIsSaving(true);
    try {
      await createOverrideMutation.mutateAsync({
        command_name: 'analyze',
        is_enabled: enabled,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const effectiveCommandName = currentAlias.trim() || 'analyze';

  return (
    <PageWrapper title="?????????? ?????">
      <div className="container mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">??????? ????</h2>
            <p className="text-sm text-muted-foreground">
              ???????????, ??????? ???????? ????? ??????? ? ????. ?????? ????? ???????????.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="card-glass lg:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <CardTitle className="text-base">?????? ???????????? ?? ??????????</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    ???????? ??????????????? ??????? ?? ??????? ?????????.
                  </p>
                </div>
                <Switch
                  checked={isEnabled}
                  disabled={!analyzeCommand || !hasPlatforms || isSaving}
                  onCheckedChange={handleToggle}
                />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                <div>
                  ???????:{' '}
                  <span className="text-foreground font-mono">!{effectiveCommandName}</span>
                </div>
                <div>
                  ?????????:{' '}
                  <span className="text-foreground font-mono">!{effectiveCommandName} &lt;???&gt;</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageWrapper>
  );
};

export default AnalyticsPage;
