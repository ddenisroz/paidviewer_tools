/**
 * Visual Feedback System Example
 * Demonstrates all visual feedback features
 * Requirements: 4.2, 4.3
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SuccessCheckmark } from '@/components/ui/success-checkmark';
import { useVisualFeedback } from '@/hooks/useVisualFeedback';
import { Check, X, Loader2 } from 'lucide-react';

export const VisualFeedbackExample: React.FC = () => {
  const [showCheckmark, setShowCheckmark] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [switchEnabled, setSwitchEnabled] = useState(false);
  
  const {
    createRipple,
    showSuccessToast,
    showErrorToast,
    showLoadingToast,
    dismissToast,
    addButtonPressEffect,
    addSuccessPulse,
    addShakeAnimation,
  } = useVisualFeedback();

  const handleRippleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    createRipple(e);
    const target = e.currentTarget;
    addButtonPressEffect(target);
  };

  const handleSuccessClick = () => {
    setShowCheckmark(true);
    showSuccessToast({
      title: 'Success!',
      description: 'Your action was completed successfully.',
    });
    setTimeout(() => setShowCheckmark(false), 2000);
  };

  const handleErrorClick = () => {
    showErrorToast('Error occurred', 'Something went wrong. Please try again.');
  };

  const handleLoadingClick = () => {
    setIsLoading(true);
    const toastId = showLoadingToast('Processing...', 'Please wait while we complete your request.');
    
    setTimeout(() => {
      dismissToast(toastId);
      setIsLoading(false);
      showSuccessToast({
        title: 'Complete!',
        description: 'Your request has been processed.',
      });
    }, 3000);
  };

  const handlePulseClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const target = e.currentTarget;
    addSuccessPulse(target);
  };

  const handleShakeClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const target = e.currentTarget;
    addShakeAnimation(target);
  };

  return (
    <div className="container mx-auto p-8 space-y-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2">Visual Feedback System</h1>
        <p className="text-muted-foreground">
          Demonstrating hover states, focus indicators, and success animations
        </p>
      </div>

      {/* Button Variants */}
      <Card>
        <CardHeader>
          <CardTitle>Button Hover & Focus States</CardTitle>
          <CardDescription>
            All buttons have enhanced hover effects with shadow and lift animation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleRippleClick}>
              Default Button
            </Button>
            <Button variant="destructive" onClick={handleRippleClick}>
              Destructive
            </Button>
            <Button variant="outline" onClick={handleRippleClick}>
              Outline
            </Button>
            <Button variant="secondary" onClick={handleRippleClick}>
              Secondary
            </Button>
            <Button variant="ghost" onClick={handleRippleClick}>
              Ghost
            </Button>
            <Button variant="link" onClick={handleRippleClick}>
              Link
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Try clicking buttons to see ripple effect. Use Tab key to test focus indicators.
          </p>
        </CardContent>
      </Card>

      {/* Input Focus States */}
      <Card>
        <CardHeader>
          <CardTitle>Input Focus & Hover States</CardTitle>
          <CardDescription>
            Inputs show enhanced border color on hover and focus ring on focus
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="Hover over me to see border change" />
          <Input placeholder="Click to see focus ring" />
          <Input placeholder="Use Tab key for keyboard navigation" />
          <p className="text-sm text-muted-foreground">
            Hover to see border color change. Focus to see ring indicator.
          </p>
        </CardContent>
      </Card>

      {/* Switch Feedback */}
      <Card>
        <CardHeader>
          <CardTitle>Switch/Toggle Feedback</CardTitle>
          <CardDescription>
            Switches have smooth transitions with shadow effects
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-3">
            <Switch
              checked={switchEnabled}
              onCheckedChange={setSwitchEnabled}
            />
            <span className="text-sm">
              {switchEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Toggle to see smooth animation with shadow effect
          </p>
        </CardContent>
      </Card>

      {/* Success Animations */}
      <Card>
        <CardHeader>
          <CardTitle>Success Animations</CardTitle>
          <CardDescription>
            Various success feedback animations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleSuccessClick}>
              <Check className="mr-2 h-4 w-4" />
              Show Success Toast
            </Button>
            <Button variant="destructive" onClick={handleErrorClick}>
              <X className="mr-2 h-4 w-4" />
              Show Error Toast
            </Button>
            <Button variant="outline" onClick={handleLoadingClick} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                'Show Loading Toast'
              )}
            </Button>
          </div>

          {showCheckmark && (
            <div className="flex justify-center p-4">
              <SuccessCheckmark size="lg" />
            </div>
          )}

          <div className="flex gap-4 items-center">
            <SuccessCheckmark size="sm" variant="simple" />
            <SuccessCheckmark size="md" variant="circle" />
            <SuccessCheckmark size="lg" variant="circle" />
          </div>

          <p className="text-sm text-muted-foreground">
            Click buttons to see different toast notifications with animations
          </p>
        </CardContent>
      </Card>

      {/* Animation Effects */}
      <Card>
        <CardHeader>
          <CardTitle>Animation Effects</CardTitle>
          <CardDescription>
            Additional visual feedback animations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button onClick={handlePulseClick}>
              Pulse Effect
            </Button>
            <Button variant="destructive" onClick={handleShakeClick}>
              Shake Effect
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Click buttons to see pulse and shake animations
          </p>
        </CardContent>
      </Card>

      {/* Interactive Cards */}
      <Card>
        <CardHeader>
          <CardTitle>Interactive Card Hover</CardTitle>
          <CardDescription>
            Cards can have hover effects when interactive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card interactive>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">Interactive Card 1</h3>
                <p className="text-sm text-muted-foreground">
                  Hover over me to see lift effect
                </p>
              </CardContent>
            </Card>
            <Card interactive>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">Interactive Card 2</h3>
                <p className="text-sm text-muted-foreground">
                  Shadow and transform on hover
                </p>
              </CardContent>
            </Card>
            <Card interactive>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">Interactive Card 3</h3>
                <p className="text-sm text-muted-foreground">
                  Smooth transition animation
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Accessibility Note */}
      <Card>
        <CardHeader>
          <CardTitle>Accessibility Features</CardTitle>
          <CardDescription>
            All feedback respects user preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-2 text-sm">
            <li>Keyboard navigation with visible focus indicators</li>
            <li>Minimum touch target size (44x44px) for mobile</li>
            <li>Reduced motion support for users who prefer it</li>
            <li>High contrast mode support</li>
            <li>All feedback provided within 200ms</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default VisualFeedbackExample;
