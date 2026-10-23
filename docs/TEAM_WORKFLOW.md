# Care-OAU — Team Workflow & Collaboration Guidelines

> **Target Audience:** SWEP Group 18 Engineering Team & Peer Contributors.

---

## 1. Branch Strategy

- **`main`**: Production-ready, fully validated code. Direct pushes are restricted during collaborative phases.
- **`develop`**: Central integration branch for merging completed features.
- **Feature Branches**: `feat/<short-description>` (e.g., `feat/doctor-capacity-warning`).
- **Bug Fix Branches**: `fix/<bug-description>` (e.g., `fix/otp-backspace-handling`).
- **Documentation**: `docs/<topic>` (e.g., `docs/api-contracts`).

---

## 2. Commit Message Standards

Care-OAU adheres to the **Conventional Commits** standard:

```text
<type>(<scope>): <concise description in imperative mood>

[optional body explaining rationale and context]
```

### Approved Types
- `feat`: A new user-facing capability or screen.
- `style`: Changes that do not affect code logic (CSS tokens, layouts, fonts, whitespace).
- `fix`: A bug fix or error resolution.
- `chore`: Tooling, build config, `.gitignore`, directory scaffolding.
- `docs`: Documentation modifications or additions in `/docs` or `README.md`.
- `refactor`: Code reorganization without functional behavior change.

---

## 3. Code Conventions

### HTML5
- Always declare `<!DOCTYPE html>` and `<html lang="en">`.
- Use descriptive `<title>` tags on every page adhering to: `<Page Name> | Care-OAU`.
- Include `<meta name="description">` for healthcare accessibility and SEO.
- Interactive elements must possess unique descriptive `id` attributes.

### CSS3
- Never hardcode color hex values directly in component rules; always reference CSS Custom Properties from `variables.css` (e.g., `var(--color-teal)`).
- Preserve the 8-point spacing system (`--space-1` through `--space-16`).
- Group media queries logically in `responsive.css` using `max-width: 1024px`, `max-width: 768px`, and `max-width: 480px`.

### JavaScript (ES6 Modules)
- Write modular code using `import` / `export`.
- Use `const` and `let`; avoid `var`.
- Keep asynchronous actions non-blocking with `async` / `await`.
- Wrap DOM queries defensively (e.g., check `if (el) ...` before attaching event listeners).
- Use `Storage` abstraction rather than direct unhandled `localStorage` access.

---

## 4. Local Testing & Verification Before Committing

Before creating Git commits or submitting Pull Requests, team members must verify:
1. No broken ES6 module imports or uncaught syntax errors in the browser console.
2. Responsive behavior on both desktop and mobile drawer viewports.
3. Forms display informative validation hints when empty or invalid inputs are submitted.
