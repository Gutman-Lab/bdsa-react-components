# Publishing Guide for bdsa-react-components

This guide covers how to publish your component library to npm and GitHub Packages so it can be installed in other applications.

## Prerequisites

1. **Build the library**: Make sure your library builds successfully
   ```bash
   npm run build
   ```

2. **Version management**: Use semantic versioning (major.minor.patch)
   - Patch (0.1.0 → 0.1.1): Bug fixes
   - Minor (0.1.0 → 0.2.0): New features (backward compatible)
   - Major (0.1.0 → 1.0.0): Breaking changes

## Option 1: Publishing to Public npm Registry

### Step 1: Create an npm Account

If you don't have one:
```bash
npm adduser
# or visit https://www.npmjs.com/signup
```

### Step 2: Login to npm

```bash
npm login
```

### Step 3: Update Repository URL (if needed)

Edit `package.json` and replace `YOUR_USERNAME` with your GitHub username:
```json
"repository": {
    "type": "git",
    "url": "https://github.com/YOUR_USERNAME/bdsa-react-components.git"
}
```

### Step 4: Verify Package Name Availability

Check if `bdsa-react-components` is available:
```bash
npm search bdsa-react-components
```

If the name is taken, update the `name` field in `package.json` to something unique (e.g., `@your-username/bdsa-react-components`).

### Step 5: Build and Publish

```bash
# Build the library
npm run build

# Publish to npm
npm publish
```

The `prepublishOnly` script will automatically run the build before publishing.

### Step 6: Install in Other Projects

Once published, users can install it with:
```bash
npm install bdsa-react-components
```

## Option 2: Publishing to GitHub Packages

GitHub Packages allows you to publish npm packages to your GitHub repository. This is great if you want to keep packages private or associated with your GitHub organization.

### Step 1: Create a Personal Access Token (PAT)

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate a new token with these permissions:
   - `read:packages`
   - `write:packages`
   - `delete:packages` (optional, for deleting packages)
3. Save the token securely (you'll need it in the next step)

### Step 2: Configure npm for GitHub Packages

Create or edit `.npmrc` file in your home directory (or project root):
```bash
# For project-specific configuration, create .npmrc in project root:
echo "@YOUR_GITHUB_USERNAME:registry=https://npm.pkg.github.com" >> .npmrc
echo "//npm.pkg.github.com/:_authToken=YOUR_PERSONAL_ACCESS_TOKEN" >> .npmrc
```

**For user-level configuration (recommended):**
```bash
# On macOS/Linux:
echo "@YOUR_GITHUB_USERNAME:registry=https://npm.pkg.github.com" >> ~/.npmrc
echo "//npm.pkg.github.com/:_authToken=YOUR_PERSONAL_ACCESS_TOKEN" >> ~/.npmrc

# On Windows:
# Edit %USERPROFILE%\.npmrc and add the same lines
```

Replace:
- `YOUR_GITHUB_USERNAME` with your GitHub username
- `YOUR_PERSONAL_ACCESS_TOKEN` with the token from Step 1

### Step 3: Update package.json for GitHub Packages

Update the `name` field to use a scoped package name:
```json
"name": "@YOUR_GITHUB_USERNAME/bdsa-react-components",
```

And update the repository URL:
```json
"repository": {
    "type": "git",
    "url": "https://github.com/YOUR_GITHUB_USERNAME/bdsa-react-components.git"
},
"publishConfig": {
    "registry": "https://npm.pkg.github.com"
}
```

### Step 4: Build and Publish

```bash
# Build the library
npm run build

# Publish to GitHub Packages
npm publish
```

### Step 5: Install from GitHub Packages

To install in other projects, users need to:

1. Create `.npmrc` in their project root:
```
@YOUR_GITHUB_USERNAME:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_PERSONAL_ACCESS_TOKEN
```

2. Install the package:
```bash
npm install @YOUR_GITHUB_USERNAME/bdsa-react-components
```

**Note**: Each user needs their own GitHub Personal Access Token with `read:packages` permission.

## Option 3: Installing Directly from GitHub (No Publishing Required)

If you don't want to publish to npm or GitHub Packages, you can install directly from the GitHub repository:

### Step 1: Push to GitHub

Make sure your repository is on GitHub:
```bash
git remote add origin https://github.com/YOUR_USERNAME/bdsa-react-components.git
git push -u origin main
```

### Step 2: Install in Other Projects

```bash
npm install git+https://github.com/YOUR_USERNAME/bdsa-react-components.git
```

Or install from a specific branch/tag:
```bash
npm install git+https://github.com/YOUR_USERNAME/bdsa-react-components.git#main
npm install git+https://github.com/YOUR_USERNAME/bdsa-react-components.git#v0.1.0
```

**Pros:**
- No publishing step needed
- Always gets latest from git
- Works with private repositories (if user has access)

**Cons:**
- Slower install times (clones git repo)
- Requires git to be installed
- No semantic versioning benefits

## Version Management

### Using npm version

The `package.json` includes scripts for automated versioning:

```bash
# Patch version (0.1.0 → 0.1.1)
npm version patch

# Minor version (0.1.0 → 0.2.0)
npm version minor

# Major version (0.1.0 → 1.0.0)
npm version major
```

This will:
1. Update version in `package.json`
2. Build the library (via `version` script)
3. Create a git commit
4. Create a git tag
5. Push changes and tags (via `postversion` script)

Then publish:
```bash
npm publish
```

### Manual Versioning

Edit `package.json` and change the version, then:
```bash
npm run build
npm publish
```

## Troubleshooting

### "Package name is already taken"
If `bdsa-react-components` is taken on npm, use a scoped package name:
```json
"name": "@your-username/bdsa-react-components"
```

Then users install with:
```bash
npm install @your-username/bdsa-react-components
```

### Authentication Errors
- **npm**: Make sure you're logged in with `npm login`
- **GitHub Packages**: Verify your `.npmrc` has the correct token

### Build Errors Before Publishing
The `prepublishOnly` script ensures the build runs before publishing. If build fails, fix errors first.

### Package Too Large
If your package is too large, check:
- Is `dist` being included? (it should be)
- Are `node_modules` accidentally included? (they shouldn't be)
- Check `.npmignore` to exclude unnecessary files

## Best Practices

1. **Always test the build** before publishing
2. **Update CHANGELOG.md** with changes for each version
3. **Tag releases** in git for easy reference
4. **Use semantic versioning** consistently
5. **Test installation** in a fresh project before announcing the release
6. **Keep dependencies minimal** - use peerDependencies for React
7. **Document breaking changes** clearly in CHANGELOG.md

## Using the Published Package

Once published, users can install and use it:

```bash
npm install bdsa-react-components
```

```tsx
import { Button, Card, SlideViewer } from 'bdsa-react-components'
import 'bdsa-react-components/styles.css'

function App() {
  return (
    <Card>
      <Button variant="primary">Click me</Button>
    </Card>
  )
}
```

## Next Steps

1. Update the repository URL in `package.json` with your GitHub username
2. Choose your publishing method (npm, GitHub Packages, or git)
3. Build and publish your first version
4. Test installation in a separate project
5. Share with your team! 🎉

