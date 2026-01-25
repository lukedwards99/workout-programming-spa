# GitHub Pages Deployment

This project is configured to deploy to GitHub Pages automatically.

## Automatic Deployment

The app automatically deploys to GitHub Pages when you push to the `main` branch via GitHub Actions.

**Live URL:** https://lukedwards99.github.io/workout-programming-spa/

## Setup (One-time)

1. Go to your GitHub repository settings
2. Navigate to **Settings → Pages**
3. Under "Build and deployment":
   - Source: Select **GitHub Actions**
4. Push to main branch - deployment will happen automatically

## Manual Deployment (Alternative)

You can also deploy manually using:

```bash
npm run build
npm run deploy
```

This will build the app and push it to the `gh-pages` branch.

## Local Development

The app runs normally in development mode:

```bash
npm run dev
```

Note: The base path `/workout-programming-spa/` is only applied in production builds, so local development uses `/`.
