/**
 * Spacing System Example Component
 * 
 * This component demonstrates the proper usage of the 8px grid spacing system.
 * Use this as a reference when building new components or updating existing ones.
 * 
 * See: frontend/SPACING_SYSTEM.md for complete documentation
 */

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const SpacingSystemExample: React.FC = () => {
  return (
    <div className="p-6 space-y-8">
      {/* Section 1: Card with Standard Spacing */}
      <section className="section-spacing">
        <h2 className="text-2xl font-bold mb-4">Card Layout Example</h2>
        <Card className="border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle>Standard Card with 8px Grid</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Content sections with 32px vertical spacing */}
            <div className="p-3 bg-gray-800 rounded">
              Section 1 - Uses p-3 (24px padding)
            </div>
            <div className="p-3 bg-gray-800 rounded">
              Section 2 - Uses p-3 (24px padding)
            </div>
            <div className="p-3 bg-gray-800 rounded">
              Section 3 - Uses p-3 (24px padding)
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Section 2: Form Layout */}
      <section className="section-spacing">
        <h2 className="text-2xl font-bold mb-4">Form Layout Example</h2>
        <Card className="border-gray-700">
          <CardContent className="pt-6">
            <form className="space-y-4">
              {/* Form fields with 32px vertical spacing */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Field Label 1</label>
                <Input placeholder="16px spacing between label and input" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Field Label 2</label>
                <Input placeholder="Consistent spacing" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Field Label 3</label>
                <Input placeholder="Uses space-y-2 (16px)" />
              </div>
              <div className="flex gap-3 pt-2">
                {/* Buttons with 24px gap */}
                <Button className="px-4 py-2">Submit</Button>
                <Button variant="outline" className="px-4 py-2">Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </section>

      {/* Section 3: List Layout */}
      <section className="section-spacing">
        <h2 className="text-2xl font-bold mb-4">List Layout Example</h2>
        <Card className="border-gray-700">
          <CardContent className="pt-6">
            <ul className="space-y-2">
              {/* List items with 16px vertical spacing */}
              <li className="p-3 bg-gray-800 rounded border border-gray-700">
                List Item 1 - Uses p-3 (24px padding)
              </li>
              <li className="p-3 bg-gray-800 rounded border border-gray-700">
                List Item 2 - Uses p-3 (24px padding)
              </li>
              <li className="p-3 bg-gray-800 rounded border border-gray-700">
                List Item 3 - Uses p-3 (24px padding)
              </li>
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* Section 4: Grid Layout */}
      <section className="section-spacing">
        <h2 className="text-2xl font-bold mb-4">Grid Layout Example</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Grid items with 32px gap */}
          <Card className="border-gray-700">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <h3 className="font-semibold">Grid Item 1</h3>
                <p className="text-sm text-gray-400">
                  Uses gap-4 (32px) between grid items
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-gray-700">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <h3 className="font-semibold">Grid Item 2</h3>
                <p className="text-sm text-gray-400">
                  Consistent spacing across all items
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-gray-700">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <h3 className="font-semibold">Grid Item 3</h3>
                <p className="text-sm text-gray-400">
                  Responsive grid with consistent gaps
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Section 5: Responsive Spacing */}
      <section className="section-spacing">
        <h2 className="text-2xl font-bold mb-4">Responsive Spacing Example</h2>
        <Card className="border-gray-700">
          <CardContent className="p-2 md:p-4 lg:p-6">
            {/* Responsive padding: 16px mobile, 32px tablet, 48px desktop */}
            <div className="space-y-2 md:space-y-4">
              {/* Responsive vertical spacing */}
              <div className="p-3 bg-gray-800 rounded">
                Responsive padding and spacing
              </div>
              <div className="p-3 bg-gray-800 rounded">
                Adapts to screen size
              </div>
              <div className="p-3 bg-gray-800 rounded">
                Mobile: 16px, Tablet: 32px spacing
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Section 6: Custom Utility Classes */}
      <section className="section-spacing">
        <h2 className="text-2xl font-bold mb-4">Custom Utility Classes Example</h2>
        <Card className="border-gray-700">
          <CardContent className="card-padding">
            {/* Uses custom utility class for standard card padding */}
            <div className="flex flex-col card-gap">
              {/* Uses custom utility class for card content gap */}
              <div className="p-3 bg-gray-800 rounded">
                Uses card-padding utility (32px)
              </div>
              <div className="p-3 bg-gray-800 rounded">
                Uses card-gap utility (24px)
              </div>
              <div className="p-3 bg-gray-800 rounded">
                Semantic spacing classes
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Section 7: Spacing Scale Reference */}
      <section className="section-spacing">
        <h2 className="text-2xl font-bold mb-4">Spacing Scale Reference</h2>
        <Card className="border-gray-700">
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <div className="w-32 text-sm font-mono">space-1 (8px)</div>
                <div className="h-8 bg-primary" style={{ width: 'var(--spacing-1)' }}></div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-32 text-sm font-mono">space-2 (16px)</div>
                <div className="h-8 bg-primary" style={{ width: 'var(--spacing-2)' }}></div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-32 text-sm font-mono">space-3 (24px)</div>
                <div className="h-8 bg-primary" style={{ width: 'var(--spacing-3)' }}></div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-32 text-sm font-mono">space-4 (32px)</div>
                <div className="h-8 bg-primary" style={{ width: 'var(--spacing-4)' }}></div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-32 text-sm font-mono">space-5 (40px)</div>
                <div className="h-8 bg-primary" style={{ width: 'var(--spacing-5)' }}></div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-32 text-sm font-mono">space-6 (48px)</div>
                <div className="h-8 bg-primary" style={{ width: 'var(--spacing-6)' }}></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Best Practices Summary */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Best Practices Summary</h2>
        <Card className="border-gray-700 bg-gray-900/50">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-green-400 mb-2">✅ DO</h3>
                <ul className="space-y-1 text-sm text-gray-300 list-disc list-inside">
                  <li>Use spacing scale consistently (p-1, p-2, p-3, etc.)</li>
                  <li>Use semantic utility classes (card-padding, form-field-gap)</li>
                  <li>Maintain visual rhythm with consistent spacing</li>
                  <li>Use responsive spacing modifiers (p-2 md:p-4)</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-red-400 mb-2">❌ DON'T</h3>
                <ul className="space-y-1 text-sm text-gray-300 list-disc list-inside">
                  <li>Avoid arbitrary values (p-[17px], m-[23px])</li>
                  <li>Don't mix spacing systems</li>
                  <li>Don't hardcode pixel values in inline styles</li>
                  <li>Don't use inconsistent spacing in similar components</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default SpacingSystemExample;
