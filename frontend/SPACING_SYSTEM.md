# Spacing System Documentation

## Overview

The application uses a consistent **8px grid spacing system** to ensure visual harmony and maintainability across all components. All spacing values are defined as CSS variables and integrated with Tailwind CSS utilities.

## Spacing Scale

The spacing scale follows an 8px grid system:

| Variable | Value | Pixels | Usage |
|----------|-------|--------|-------|
| `--spacing-0` | 0 | 0px | No spacing |
| `--spacing-1` | 0.5rem | 8px | Minimal spacing (tight elements) |
| `--spacing-2` | 1rem | 16px | Small spacing (form fields, list items) |
| `--spacing-3` | 1.5rem | 24px | Medium spacing (card content) |
| `--spacing-4` | 2rem | 32px | Large spacing (card padding) |
| `--spacing-5` | 2.5rem | 40px | Extra large spacing |
| `--spacing-6` | 3rem | 48px | XXL spacing (sections) |
| `--spacing-8` | 4rem | 64px | Section spacing |
| `--spacing-10` | 5rem | 80px | Large section spacing |
| `--spacing-12` | 6rem | 96px | Page spacing |

## Component-Specific Presets

Pre-defined spacing values for common component patterns:

| Variable | Value | Usage |
|----------|-------|-------|
| `--card-padding` | 32px | Standard padding inside cards |
| `--card-gap` | 24px | Gap between elements within cards |
| `--section-gap` | 48px | Gap between major sections |
| `--form-field-gap` | 16px | Gap between form fields |
| `--button-padding-x` | 24px | Button horizontal padding |
| `--button-padding-y` | 16px | Button vertical padding |
| `--list-item-gap` | 16px | Gap between list items |

## Usage with Tailwind CSS

### Standard Spacing Utilities

Use Tailwind's spacing utilities with the 8px grid values:

```jsx
// Padding
<div className="p-4">        {/* 32px padding on all sides */}
<div className="px-3 py-2">  {/* 24px horizontal, 16px vertical */}

// Margin
<div className="m-2">        {/* 16px margin on all sides */}
<div className="mt-6 mb-4">  {/* 48px top, 32px bottom */}

// Gap (for flexbox/grid)
<div className="flex gap-3"> {/* 24px gap between children */}
<div className="grid gap-4"> {/* 32px gap between grid items */}

// Space (for flex children)
<div className="flex flex-col space-y-2"> {/* 16px vertical spacing */}
<div className="flex space-x-4">         {/* 32px horizontal spacing */}
```

### Custom Utility Classes

Use pre-defined utility classes for common patterns:

```jsx
// Card spacing
<Card className="card-padding">     {/* Standard card padding */}
<div className="flex flex-col card-gap"> {/* Card content gap */}

// Section spacing
<section className="section-spacing"> {/* Section bottom margin */}
<div className="flex flex-col section-gap"> {/* Large section gap */}

// Form spacing
<form className="flex flex-col form-field-gap"> {/* Form field gaps */}
<div className="form-spacing">                  {/* Form field margin */}

// List spacing
<ul className="flex flex-col list-gap"> {/* List item gaps */}

// Button spacing
<button className="button-padding">  {/* Standard button padding */}
```

### Direct CSS Variable Usage

For custom components or inline styles:

```jsx
// Using CSS variables directly
<div style={{ padding: 'var(--spacing-4)' }}>
  Content with 32px padding
</div>

// In CSS modules or styled components
.custom-component {
  padding: var(--card-padding);
  gap: var(--card-gap);
  margin-bottom: var(--section-gap);
}
```

## Best Practices

### ✅ DO

- **Use the spacing scale consistently** - Always use values from the 8px grid
- **Use Tailwind utilities** - Prefer `p-4` over arbitrary values like `p-[32px]`
- **Use semantic presets** - Use `card-padding` for cards, `form-field-gap` for forms
- **Maintain visual rhythm** - Use consistent spacing within similar components
- **Stack spacing utilities** - Combine utilities like `px-4 py-2` for different axes

### ❌ DON'T

- **Avoid arbitrary values** - Don't use `p-[17px]` or `m-[23px]`
- **Don't mix systems** - Don't combine 8px grid with random values
- **Don't hardcode pixels** - Avoid inline styles with hardcoded pixel values
- **Don't use inconsistent spacing** - Keep spacing uniform across similar elements

## Common Patterns

### Card Layout

```jsx
<Card className="border-gray-700">
  <CardHeader className="pb-3">
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* Content with 32px vertical spacing */}
    <div>Section 1</div>
    <div>Section 2</div>
  </CardContent>
</Card>
```

### Form Layout

```jsx
<form className="space-y-4">
  {/* Form fields with 32px vertical spacing */}
  <div className="space-y-2">
    <label>Field Label</label>
    <input className="p-2" />
  </div>
  <div className="space-y-2">
    <label>Another Field</label>
    <input className="p-2" />
  </div>
  <button className="px-4 py-2">Submit</button>
</form>
```

### Section Layout

```jsx
<div className="space-y-6">
  {/* Sections with 48px vertical spacing */}
  <section>
    <h2 className="mb-3">Section Title</h2>
    <div className="space-y-2">
      {/* Content with 16px spacing */}
    </div>
  </section>
  <section>
    <h2 className="mb-3">Another Section</h2>
    <div className="space-y-2">
      {/* Content with 16px spacing */}
    </div>
  </section>
</div>
```

### List Layout

```jsx
<ul className="space-y-2">
  {/* List items with 16px vertical spacing */}
  <li className="p-3 border rounded">Item 1</li>
  <li className="p-3 border rounded">Item 2</li>
  <li className="p-3 border rounded">Item 3</li>
</ul>
```

## Migration Guide

When updating existing components to use the spacing system:

1. **Identify current spacing** - Look for padding, margin, gap values
2. **Map to 8px grid** - Find the closest value from the spacing scale
3. **Replace with utilities** - Use Tailwind classes or CSS variables
4. **Test visually** - Ensure the layout looks correct after changes

### Example Migration

**Before:**
```jsx
<div style={{ padding: '30px', marginBottom: '25px' }}>
  <div style={{ gap: '20px' }}>
    Content
  </div>
</div>
```

**After:**
```jsx
<div className="p-4 mb-3">  {/* 32px padding, 24px margin */}
  <div className="flex gap-3">  {/* 24px gap */}
    Content
  </div>
</div>
```

## Responsive Spacing

Use Tailwind's responsive modifiers with the spacing system:

```jsx
<div className="p-2 md:p-4 lg:p-6">
  {/* 16px on mobile, 32px on tablet, 48px on desktop */}
</div>

<div className="space-y-2 md:space-y-4">
  {/* 16px spacing on mobile, 32px on tablet+ */}
</div>
```

## Accessibility Considerations

- **Touch targets** - Ensure interactive elements have at least 44x44px touch area (use `p-3` minimum)
- **Visual hierarchy** - Use larger spacing (`space-y-6`) between major sections
- **Reading flow** - Use consistent spacing (`space-y-2` or `space-y-3`) for related content
- **Focus indicators** - Ensure spacing doesn't interfere with focus rings

## Related Documentation

- [Tailwind CSS Spacing](https://tailwindcss.com/docs/customizing-spacing)
- [Design System Colors](./src/App.css) - See `:root` variables
- [Component Library](./src/components/ui/) - shadcn/ui components

## Questions?

If you're unsure which spacing value to use:

- **Tight spacing** (8-16px) - Related elements, form fields, list items
- **Medium spacing** (24-32px) - Card content, component sections
- **Large spacing** (48-64px) - Major sections, page layout

When in doubt, use `space-y-4` (32px) for vertical spacing - it's the most commonly used value.
