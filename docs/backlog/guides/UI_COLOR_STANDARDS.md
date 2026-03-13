# UI Color Standards

Status: active.

This guide defines semantic color usage for admin and user interfaces.

## Primary Rule

Use semantic tokens first. Avoid hardcoded gray/white combinations when a semantic token exists.

## Buttons

1. Primary action
- token: `bg-primary` + `text-primary-foreground`
- use for save/apply/confirm actions

2. Secondary action
- variant: `outline` or `ghost`
- use for non-destructive helper actions

3. Success state
- token family: green semantic styles
- use only for successful status and confirmations

4. Destructive action
- token family: destructive/red semantic styles
- use for delete/reset/revoke actions

## Text And Surfaces

1. Main text: `text-foreground`
2. Secondary text: `text-muted-foreground`
3. Card/background: `bg-card`
4. Borders/dividers: `border-border`

## Accessibility

1. Keep contrast ratio readable for all state badges.
2. Do not encode critical state by color alone.
3. Provide icon/label support for state meaning.

## Admin UI Consistency

1. Keep heading hierarchy stable.
2. Keep action button heights consistent (`h-8`/`h-9`).
3. Keep spacing rhythm consistent between admin pages.

## Open Checklist

- Review all save buttons and enforce primary style.
- Ensure green styles are used only for success/full-auth indicators.
- Ensure informational indicators use non-success semantic colors.
