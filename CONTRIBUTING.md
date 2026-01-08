# 🤝 Contributing to Fabrix

Thank you for your interest in contributing to the Fabrix Fleet Management System! This document provides guidelines and instructions for contributing.

---

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Code Style](#code-style)
- [Testing](#testing)
- [Documentation](#documentation)

---

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment. Please:

- Be respectful and constructive in discussions
- Welcome newcomers and help them get started
- Focus on what is best for the project and community
- Show empathy towards other community members

---

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- Node.js 18.0 or higher
- npm or yarn package manager
- Git installed and configured
- A code editor (VS Code recommended)
- ProtoNest account for testing (optional)

### First-Time Setup

1. **Fork the repository** on GitHub

2. **Clone your fork**

   ```bash
   git clone https://github.com/YOUR-USERNAME/Fleet-Management-System_PC.git
   cd Fleet-Management-System_PC
   ```

3. **Add upstream remote**

   ```bash
   git remote add upstream https://github.com/ttmagedara2001/Fleet-Management-System_PC.git
   ```

4. **Install dependencies**

   ```bash
   npm install
   ```

5. **Create environment file**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

---

## Development Setup

### Running the Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Available Scripts

| Script            | Description              |
| ----------------- | ------------------------ |
| `npm run dev`     | Start development server |
| `npm run build`   | Build for production     |
| `npm run preview` | Preview production build |
| `npm run lint`    | Run ESLint               |

### Project Structure

```
src/
├── components/     # React components
│   ├── dashboard/  # Dashboard-specific components
│   └── layout/     # Layout components (Header, Sidebar)
├── contexts/       # React Context providers
├── hooks/          # Custom React hooks
├── pages/          # Page components
├── services/       # API and WebSocket services
├── types/          # Type definitions
├── App.jsx         # Main application component
└── main.jsx        # Entry point
```

---

## Making Changes

### 1. Create a Branch

Always create a new branch for your changes:

```bash
# Update main branch
git checkout main
git pull upstream main

# Create feature branch
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/bug-description
```

### 2. Branch Naming Convention

| Type     | Pattern                | Example                          |
| -------- | ---------------------- | -------------------------------- |
| Feature  | `feature/description`  | `feature/add-robot-history`      |
| Bug Fix  | `fix/description`      | `fix/battery-display-error`      |
| Docs     | `docs/description`     | `docs/update-api-reference`      |
| Refactor | `refactor/description` | `refactor/optimize-websocket`    |
| Style    | `style/description`    | `style/improve-dashboard-layout` |

### 3. Make Your Changes

- Keep changes focused and atomic
- Follow the existing code style
- Update documentation as needed
- Add comments for complex logic

### 4. Test Your Changes

- Test all affected functionality
- Check browser console for errors
- Test with different devices/browsers
- Verify WebSocket connections work

---

## Commit Guidelines

### Commit Message Format

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type       | Description                   |
| ---------- | ----------------------------- |
| `feat`     | New feature                   |
| `fix`      | Bug fix                       |
| `docs`     | Documentation only            |
| `style`    | Code style (formatting, etc.) |
| `refactor` | Code refactoring              |
| `perf`     | Performance improvement       |
| `test`     | Adding tests                  |
| `chore`    | Maintenance tasks             |

### Examples

```bash
# Feature
git commit -m "feat(dashboard): add robot task queue display"

# Bug fix
git commit -m "fix(websocket): resolve reconnection loop issue"

# Documentation
git commit -m "docs(readme): update installation instructions"

# Refactor
git commit -m "refactor(api): simplify error handling logic"
```

### Commit Best Practices

- Keep commits small and focused
- Write clear, descriptive messages
- Reference issues when applicable: `fix(auth): resolve token expiry (#42)`
- Don't commit generated files or dependencies

---

## Pull Request Process

### 1. Before Submitting

- [ ] Update your branch with latest main
- [ ] Run linting: `npm run lint`
- [ ] Test all affected functionality
- [ ] Update documentation if needed
- [ ] Write clear PR description

### 2. Pull Request Template

When creating a PR, include:

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Refactoring
- [ ] Other (describe)

## Testing Done

- [ ] Tested locally
- [ ] Tested with real device data
- [ ] Tested edge cases

## Screenshots (if applicable)

Add screenshots for UI changes

## Related Issues

Closes #XX
```

### 3. Review Process

1. Submit your PR
2. Address any automated checks
3. Wait for code review
4. Make requested changes
5. Get approval and merge

---

## Code Style

### JavaScript/React Guidelines

```javascript
// ✅ Good: Functional components with hooks
function RobotCard({ robot }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return <div className="robot-card">{/* Component content */}</div>;
}

// ✅ Good: Destructure props
function StatusBadge({ status, isConnected }) {
  // ...
}

// ✅ Good: Use meaningful variable names
const activeRobots = robots.filter((r) => r.status?.state === "ACTIVE");

// ❌ Bad: Unclear names
const x = robots.filter((r) => r.s?.st === "A");
```

### CSS/Tailwind Guidelines

```jsx
// ✅ Good: Use Tailwind classes
<div className="flex items-center gap-4 p-4 bg-white rounded-lg shadow">

// ✅ Good: Organize classes logically
// Layout → Spacing → Typography → Colors → Effects
<button className="flex items-center px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700">

// ❌ Bad: Inline styles (use sparingly)
<div style={{ display: 'flex', padding: '16px' }}>
```

### File Organization

```
// Component file structure
components/
└── dashboard/
    └── RobotCard/
        ├── RobotCard.jsx    # Component
        ├── RobotCard.css    # Styles (if needed)
        └── index.js         # Export
```

---

## Testing

### Manual Testing Checklist

When submitting changes, test:

- [ ] Application loads without errors
- [ ] WebSocket connects successfully
- [ ] Data displays correctly
- [ ] Controls respond appropriately
- [ ] Navigation works
- [ ] Responsive on different screen sizes
- [ ] No console errors or warnings

### Testing Tips

1. **Test with mock data** when real devices unavailable
2. **Test edge cases** (empty data, errors, timeouts)
3. **Test different browsers** (Chrome, Firefox, Safari, Edge)
4. **Test connection loss** scenarios

---

## Documentation

### When to Update Documentation

Update docs when you:

- Add new features
- Change existing behavior
- Fix bugs that users might encounter
- Add new configuration options
- Modify API interfaces

### Documentation Files

| File               | Purpose           | Update When      |
| ------------------ | ----------------- | ---------------- |
| README.md          | Project overview  | Major features   |
| USER_MANUAL.md     | User guide        | UI/UX changes    |
| API_REFERENCE.md   | API docs          | API changes      |
| TROUBLESHOOTING.md | Problem solutions | New issues found |
| CHANGELOG.md       | Version history   | Every release    |

### Documentation Style

- Use clear, concise language
- Include code examples where helpful
- Add screenshots for UI features
- Keep formatting consistent

---

## Questions?

If you have questions about contributing:

1. Check existing documentation
2. Search closed issues and PRs
3. Open a new issue for discussion

Thank you for contributing to Fabrix! 🚀

---

<div align="center">

**Happy Coding!** 👨‍💻👩‍💻

</div>
