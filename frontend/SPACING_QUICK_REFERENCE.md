# Spacing System Quick Reference

## 8px Grid Scale

| Class | Value | Use For |
|-------|-------|---------|
| `p-1`, `m-1`, `gap-1` | 8px | Minimal spacing, tight elements |
| `p-2`, `m-2`, `gap-2` | 16px | **Form fields, list items** ⭐ |
| `p-3`, `m-3`, `gap-3` | 24px | **Card content, buttons** ⭐ |
| `p-4`, `m-4`, `gap-4` | 32px | **Card padding, sections** ⭐ Most common |
| `p-5`, `m-5`, `gap-5` | 40px | Extra large spacing |
| `p-6`, `m-6`, `gap-6` | 48px | **Major sections** ⭐ |
| `p-8`, `m-8`, `gap-8` | 64px | Large section spacing |

## Common Patterns

### Card
```jsx
<Card>
  <CardHeader className="pb-3">
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* 32px spacing between sections */}
  </CardContent>
</Card>
```

### Form
```jsx
<form className="space-y-4">
  <div className="space-y-2">
    <label>Label</label>
    <Input className="p-2" />
  </div>
</form>
```

### List
```jsx
<ul className="space-y-2">
  <li className="p-3">Item</li>
</ul>
```

### Grid
```jsx
<div className="grid grid-cols-3 gap-4">
  <div>Item</div>
</div>
```

### Sections
```jsx
<div className="space-y-6">
  <section>Section 1</section>
  <section>Section 2</section>
</div>
```

## Custom Utilities

| Class | Value | Use For |
|-------|-------|---------|
| `card-padding` | 32px | Standard card padding |
| `card-gap` | 24px | Gap between card elements |
| `section-gap` | 48px | Gap between sections |
| `form-field-gap` | 16px | Gap between form fields |
| `button-padding` | 16px/24px | Button padding (y/x) |

## Responsive

```jsx
<div className="p-2 md:p-4 lg:p-6">
  {/* 16px → 32px → 48px */}
</div>
```

## ✅ DO / ❌ DON'T

✅ `<div className="p-4">`  
❌ `<div className="p-[30px]">`

✅ `<div className="space-y-2">`  
❌ `<div style={{ gap: '15px' }}>`

✅ `<Card className="card-padding">`  
❌ `<Card style={{ padding: '28px' }}>`

## Most Used Values

1. **space-y-4** (32px) - Default vertical spacing
2. **p-3** (24px) - Button/element padding
3. **gap-4** (32px) - Grid/flex gaps
4. **space-y-2** (16px) - Form fields, list items
5. **p-6** (48px) - Page/section padding

See `frontend/SPACING_SYSTEM.md` for complete documentation.
