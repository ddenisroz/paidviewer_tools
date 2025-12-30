/**
 * Design System Example Component
 * Демонстрирует правильное использование Design System
 */
import React from 'react';

import { Edit, Plus, Save, Trash2 } from 'lucide-react';

import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';


export const DesignSystemExample: React.FC = () => {
  return (
    <div className="space-y-8 p-6 max-w-6xl mx-auto">
      {/* Заголовок */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Design System Examples</h1>
        <p className="text-muted-foreground">
          Примеры правильного использования компонентов
        </p>
      </div>

      {/* Spacing Examples */}
      <Card>
        <CardHeader>
          <CardTitle>Spacing System (8px grid)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* gap-2 (8px) */}
          <div>
            <Label className="mb-2 block">gap-2 (8px) - между связанными элементами</Label>
            <div className="flex gap-2">
              <Button size="sm">Кнопка 1</Button>
              <Button size="sm">Кнопка 2</Button>
              <Button size="sm">Кнопка 3</Button>
            </div>
          </div>

          {/* gap-4 (16px) */}
          <div>
            <Label className="mb-2 block">gap-4 (16px) - стандартные отступы</Label>
            <div className="flex gap-4">
              <Button>Кнопка 1</Button>
              <Button>Кнопка 2</Button>
              <Button>Кнопка 3</Button>
            </div>
          </div>

          {/* gap-6 (24px) */}
          <div>
            <Label className="mb-2 block">gap-6 (24px) - между секциями</Label>
            <div className="flex gap-6">
              <Button size="lg">Кнопка 1</Button>
              <Button size="lg">Кнопка 2</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Button Sizes */}
      <Card>
        <CardHeader>
          <CardTitle>Button Sizes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Small (h-8, 32px)</Label>
            <div className="flex gap-2">
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Маленькая
              </Button>
              <Button size="sm" variant="outline">Outline</Button>
              <Button size="sm" variant="ghost">Ghost</Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Default (h-10, 40px) - ИСПОЛЬЗУЙТЕ ПО УМОЛЧАНИЮ</Label>
            <div className="flex gap-2">
              <Button>
                <Save className="h-4 w-4 mr-2" />
                Стандартная
              </Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Large (h-12, 48px)</Label>
            <div className="flex gap-2">
              <Button size="lg">
                <Edit className="h-4 w-4 mr-2" />
                Большая
              </Button>
              <Button size="lg" variant="outline">Outline</Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Icon (40x40px)</Label>
            <div className="flex gap-2">
              <Button size="icon">
                <Save className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="outline">
                <Edit className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Form Example */}
      <Card>
        <CardHeader>
          <CardTitle>Form Layout</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Правильная структура формы */}
          <div className="space-y-2">
            <Label htmlFor="name">Имя</Label>
            <Input id="name" placeholder="Введите имя" className="h-9" />
            <p className="text-xs text-muted-foreground">
              Подсказка для пользователя
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="email@example.com" className="h-9" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Описание</Label>
            <Input id="description" placeholder="Краткое описание" className="h-9" />
          </div>

          {/* Switch с правильными отступами */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="space-y-1">
              <Label htmlFor="notifications">Уведомления</Label>
              <p className="text-xs text-muted-foreground">
                Получать уведомления о новых событиях
              </p>
            </div>
            <Switch id="notifications" />
          </div>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button className="h-10">
            <Save className="h-4 w-4 mr-2" />
            Сохранить
          </Button>
          <Button variant="outline" className="h-10">
            Отмена
          </Button>
        </CardFooter>
      </Card>

      {/* Grid Layout */}
      <Card>
        <CardHeader>
          <CardTitle>Grid Layouts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 2 колонки */}
          <div>
            <Label className="mb-4 block">2 колонки (lg:grid-cols-2)</Label>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="border-dashed">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Колонка 1</p>
                </CardContent>
              </Card>
              <Card className="border-dashed">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Колонка 2</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* 3 колонки */}
          <div>
            <Label className="mb-4 block">3 колонки (lg:grid-cols-3)</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="border-dashed">
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Колонка {i}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Typography */}
      <Card>
        <CardHeader>
          <CardTitle>Typography Scale</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">text-xs (12px)</p>
            <p className="text-xs">Мелкий текст для меток и подсказок</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">text-sm (14px)</p>
            <p className="text-sm">Основной текст UI элементов</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">text-base (16px)</p>
            <p className="text-base">Основной текст контента</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">text-lg (18px)</p>
            <p className="text-lg">Подзаголовки</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">text-xl (20px)</p>
            <p className="text-xl font-semibold">Заголовки карточек</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">text-2xl (24px)</p>
            <p className="text-2xl font-bold">Заголовки секций</p>
          </div>
        </CardContent>
      </Card>

      {/* Colors */}
      <Card>
        <CardHeader>
          <CardTitle>Theme Colors</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="h-16 bg-primary rounded-lg" />
              <p className="text-xs">bg-primary</p>
            </div>
            <div className="space-y-2">
              <div className="h-16 bg-secondary rounded-lg" />
              <p className="text-xs">bg-secondary</p>
            </div>
            <div className="space-y-2">
              <div className="h-16 bg-accent rounded-lg" />
              <p className="text-xs">bg-accent</p>
            </div>
            <div className="space-y-2">
              <div className="h-16 bg-muted rounded-lg" />
              <p className="text-xs">bg-muted</p>
            </div>
            <div className="space-y-2">
              <div className="h-16 bg-destructive rounded-lg" />
              <p className="text-xs">bg-destructive</p>
            </div>
            <div className="space-y-2">
              <div className="h-16 bg-card border border-border rounded-lg" />
              <p className="text-xs">bg-card</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Badges */}
      <Card>
        <CardHeader>
          <CardTitle>Badges</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Destructive</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Anti-patterns */}
      <Card className="border-red-500/50">
        <CardHeader>
          <CardTitle className="text-red-500">[ERROR] Что НЕ делать</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Произвольные значения:</p>
            <code className="text-xs bg-muted p-2 rounded block">
              {`<div className="p-[13px] gap-[17px]"> // [ERROR] ПЛОХО`}
            </code>
            <code className="text-xs bg-muted p-2 rounded block mt-2">
              {`<div className="p-4 gap-4"> // [OK] ХОРОШО`}
            </code>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Несогласованные размеры:</p>
            <code className="text-xs bg-muted p-2 rounded block">
              {`<Button className="h-9">...</Button> // [ERROR] ПЛОХО`}
            </code>
            <code className="text-xs bg-muted p-2 rounded block mt-2">
              {`<Button className="h-10">...</Button> // [OK] ХОРОШО`}
            </code>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Inline styles:</p>
            <code className="text-xs bg-muted p-2 rounded block">
              {`<div style={{ padding: '16px' }}> // [ERROR] ПЛОХО`}
            </code>
            <code className="text-xs bg-muted p-2 rounded block mt-2">
              {`<div className="p-4"> // [OK] ХОРОШО`}
            </code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DesignSystemExample;
