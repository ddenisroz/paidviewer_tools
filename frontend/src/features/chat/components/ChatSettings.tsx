// src/components/chat/ChatSettings.tsx
import React from 'react';

import { Copy, MessageCircle, Settings, X } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Label } from '@/shared/components/ui/label';
import { Separator } from '@/shared/components/ui/separator';
import { toast } from '@/utils/toastManager';

interface ObsSettings {
    width: number;
    height: number;
    fontFamily: string;
    fontSize: number;
    backgroundColor: string;
    textColor: string;
}

interface ChatSettingsProps {
    showObsSettings: boolean;
    setShowObsSettings: (show: boolean) => void;
    obsSettings: ObsSettings;
    setObsSettings: React.Dispatch<React.SetStateAction<ObsSettings>>;
    twitchEnabled: boolean;
    vkEnabled: boolean;
    generateObsUrl: () => string;
}

const ChatSettings: React.FC<ChatSettingsProps> = ({
    showObsSettings,
    setShowObsSettings,
    obsSettings,
    setObsSettings,
    generateObsUrl,
}) => {
    if (!showObsSettings) {
        return null;
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <Settings className="h-6 w-6" />
                        OBS Settings
                    </CardTitle>
                    <Button
                        variant="default"
                        size="sm"
                        onClick={() => setShowObsSettings(false)}
                        className="bg-blue-700 hover:bg-blue-800 text-white font-medium px-4 py-2"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Size Settings */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Size</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Width (px)</Label>
                            <input
                                type="number"
                                value={obsSettings.width}
                                onChange={(e) =>
                                    setObsSettings((prev) => ({
                                        ...prev,
                                        width: parseInt(e.target.value) || 400,
                                    }))
                                }
                                className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-800 text-white"
                                min="200"
                                max="1920"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Height (px)</Label>
                            <input
                                type="number"
                                value={obsSettings.height}
                                onChange={(e) =>
                                    setObsSettings((prev) => ({
                                        ...prev,
                                        height: parseInt(e.target.value) || 600,
                                    }))
                                }
                                className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-800 text-white"
                                min="200"
                                max="1080"
                            />
                        </div>
                    </div>
                </div>

                <Separator />

                {/* Font Settings */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Font</h3>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Font Family</Label>
                            <select
                                value={obsSettings.fontFamily}
                                onChange={(e) =>
                                    setObsSettings((prev) => ({
                                        ...prev,
                                        fontFamily: e.target.value,
                                    }))
                                }
                                className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-800 text-white"
                            >
                                <option value="Arial">Arial</option>
                                <option value="Helvetica">Helvetica</option>
                                <option value="Times New Roman">Times New Roman</option>
                                <option value="Courier New">Courier New</option>
                                <option value="Verdana">Verdana</option>
                                <option value="Georgia">Georgia</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Font Size</Label>
                                <span className="text-sm text-muted-foreground">{obsSettings.fontSize}px</span>
                            </div>
                            <input
                                type="range"
                                min="10"
                                max="48"
                                value={obsSettings.fontSize}
                                onChange={(e) =>
                                    setObsSettings((prev) => ({
                                        ...prev,
                                        fontSize: parseInt(e.target.value),
                                    }))
                                }
                                className="w-full"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Background Color</Label>
                            <input
                                type="color"
                                value={obsSettings.backgroundColor}
                                onChange={(e) =>
                                    setObsSettings((prev) => ({
                                        ...prev,
                                        backgroundColor: e.target.value,
                                    }))
                                }
                                className="w-full h-10 border border-gray-600 rounded-md bg-gray-800"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Text Color</Label>
                            <input
                                type="color"
                                value={obsSettings.textColor}
                                onChange={(e) =>
                                    setObsSettings((prev) => ({
                                        ...prev,
                                        textColor: e.target.value,
                                    }))
                                }
                                className="w-full h-10 border border-gray-600 rounded-md bg-gray-800"
                            />
                        </div>
                    </div>
                </div>

                <Separator />

                {/* URL for OBS */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold">URL for OBS</h3>

                    {/* Chat URL section */}
                    <div className="space-y-2 p-3 border rounded-lg bg-blue-500/10">
                        <div className="flex items-center gap-2 mb-2">
                            <MessageCircle className="h-4 w-4 text-blue-500" />
                            <span className="font-medium text-sm">Chat</span>
                            <span className="text-xs text-muted-foreground">(includes all platforms)</span>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                onClick={() => {
                                    const url = generateObsUrl();
                                    navigator.clipboard.writeText(url);
                                    toast.success('URL copied to clipboard');
                                }}
                            >
                                <Copy className="h-4 w-4 mr-1" />
                                Copy URL
                            </Button>
                        </div>
                        <div className="text-xs text-muted-foreground italic">
                            Add this URL as a Browser Source in OBS
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default ChatSettings;
