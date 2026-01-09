import React, { useEffect, useRef, useState } from 'react';

import { Copy, ExternalLink, Loader2, Monitor, Settings2 } from 'lucide-react';

import { useDropsConfig, useGenerateDropsWidgetUrl, useUpdateDropsConfig } from '@/queries/drops/dropsQueries';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Slider } from '@/shared/components/ui/slider';
import { useAutoSave } from '@/shared/hooks/useAutoSave';
import { toast } from '@/utils/toastManager';


import type { DropsConfig } from '@/types/drops';

interface WidgetSettingsProps {
    user: Record<string, unknown>;
    channelName: string;
}

interface FormData {
    widget_spinning_duration_ms: number[];
    widget_opening_duration_ms: number[];
    widget_result_duration_ms: number[];
}

const WidgetSettings: React.FC<WidgetSettingsProps> = ({ user, channelName }) => {
  const [widgetUrl, setWidgetUrl] = useState<string | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // [OK] ����� ���: ���������� ���������������� hooks
  const { data: config, isLoading: _configLoading } = useDropsConfig(channelName, {
    enabled: !!user && !!channelName,
  });
  
  const updateConfigMutation = useUpdateDropsConfig(channelName, {
    onSuccess: () => {
      // �������������� �������� ����, ��� toast
    },
  });
  
  const generateWidgetUrlMutation = useGenerateDropsWidgetUrl({
    onSuccess: (response) => {
      const responseData = response as { success?: boolean; data?: { url?: string } };
      if (responseData.success && responseData.data?.url) {
        setWidgetUrl(responseData.data.url);
      }
    },
  });

  const [formData, setFormData] = useState<FormData>({
    widget_spinning_duration_ms: [1500],
    widget_opening_duration_ms: [1000],
    widget_result_duration_ms: [5500]
  });

  // ��������� ������������ � ���������� URL ������� ��� ������������
  useEffect(() => {
    if (config) {
      setFormData({
        widget_spinning_duration_ms: [config.widget_spinning_duration_ms ?? 1500],
        widget_opening_duration_ms: [config.widget_opening_duration_ms ?? 1000],
        widget_result_duration_ms: [config.widget_result_duration_ms ?? 5500]
      });
    }
  }, [config]);

  // ���������� URL ������� ��� ������������
  useEffect(() => {
    if (user && channelName && !widgetUrl) {
      generateWidgetUrlMutation.mutate(false);
    }
  }, [user, channelName]);

  // [OK] �������������� � ���������
  const { autoSave } = useAutoSave(
    (payload: Partial<DropsConfig>) => updateConfigMutation.mutate(payload),
    1000,
    () => {
      if (!user || !channelName || !config) return '������������ ������ ��� ����������';
      return null;
    }
  );

  // [OK] �������������� ��� ��������� �����
  useEffect(() => {
    if (config) {
      const payload = {
        widget_spinning_duration_ms: formData.widget_spinning_duration_ms[0],
        widget_opening_duration_ms: formData.widget_opening_duration_ms[0],
        widget_result_duration_ms: formData.widget_result_duration_ms[0]
      };
      autoSave(payload);
    }
  }, [
    formData.widget_spinning_duration_ms,
    formData.widget_opening_duration_ms,
    formData.widget_result_duration_ms,
    config,
    autoSave
  ]);
  
  // ������� ������� ��� ���������������
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const handleRegenerateWidgetUrl = () => {
    generateWidgetUrlMutation.mutate(true);
  };

  const copyWidgetUrl = () => {
    if (widgetUrl) {
      navigator.clipboard.writeText(widgetUrl);
      toast.success('URL ���������� � ����� ������');
    }
  };

  return (
    <div className="space-y-4">
      {/* ��������� �������� */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            ��������� ��������
          </CardTitle>
          <CardDescription className="text-xs">
            ������������ ��� �������� �������� �������� � OBS �������
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">������ (��)</Label>
                <span className="text-lg font-semibold">{formData.widget_spinning_duration_ms[0]}</span>
              </div>
              <Slider
                value={formData.widget_spinning_duration_ms}
                onValueChange={(value) => setFormData({...formData, widget_spinning_duration_ms: value})}
                min={500}
                max={5000}
                step={100}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">�������� (��)</Label>
                <span className="text-lg font-semibold">{formData.widget_opening_duration_ms[0]}</span>
              </div>
              <Slider
                value={formData.widget_opening_duration_ms}
                onValueChange={(value) => setFormData({...formData, widget_opening_duration_ms: value})}
                min={500}
                max={3000}
                step={100}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">��������� (��)</Label>
                <span className="text-lg font-semibold">{formData.widget_result_duration_ms[0]}</span>
              </div>
              <Slider
                value={formData.widget_result_duration_ms}
                onValueChange={(value) => setFormData({...formData, widget_result_duration_ms: value})}
                min={2000}
                max={15000}
                step={500}
              />
            </div>
          </div>

          {/* [OK] ������ ������ - �������������� �������� ������������� */}
          <p className="text-xs text-muted-foreground italic">
            ��������� ����������� ������������� ��� ���������
          </p>
        </CardContent>
      </Card>

      {/* URL ������� */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Monitor className="w-5 h-5" />
            OBS ������
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* [OK] ������ ���������� OBS */}
          {widgetUrl ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">URL �������</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerateWidgetUrl}
                  disabled={generateWidgetUrlMutation.isPending}
                  className="gap-2 text-xs"
                >
                  {generateWidgetUrlMutation.isPending ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      �������������...
                    </>
                  ) : (
                    <>
                      <Settings2 className="w-3 h-3" />
                      ����������������
                    </>
                  )}
                </Button>
              </div>
              <div className="flex gap-2">
                <Input
                  value={widgetUrl}
                  readOnly
                  className="flex-1 font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyWidgetUrl}
                  className="gap-2"
                >
                  <Copy className="w-4 h-4" />
                  ����������
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(widgetUrl, '_blank')}
                  className="gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  ������� ������
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-4 border rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">
                URL ������� �����������...
              </p>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
};

export default WidgetSettings;


