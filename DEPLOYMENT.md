# Deploying KABS Quotation AI to Render

This guide outlines the steps to deploy the React frontend application to [Render](https://render.com) as a Static Site.

## Prerequisites

1. **GitHub Repository**: Ensure your code is pushed to a GitHub repository.
2. **Render Account**: Sign up at [dashboard.render.com](https://dashboard.render.com).

## Step 1: Create a Static Site

1. In the Render Dashboard, click **New +** and select **Static Site**.
2. Connect your GitHub account and select the repository containing this project.

## Step 2: Configure Build Settings

Use the following settings for the deployment configuration:

| Setting | Value | Notes |
| :--- | :--- | :--- |
| **Name** | `kabs-quotation-app` | Or any name you prefer |
| **Branch** | `main` | Or your production branch |
| **Root Directory** | `.` | Leave blank (default) |
| **Build Command** | `npm install && npm run build` | Installs dependencies and builds the app |
| **Publish Directory** | `dist` | **IMPORTANT**: Must be exactly `dist`. Do not add a dot. |

## Step 3: Environment Variables

This application requires specific keys to function. 
Go to the **Environment** tab in your Render Static Site settings and add the following:

| Key | Value | Description |
| :--- | :--- | :--- |
| `VITE_API_KEY` | `Your_Gemini_API_Key` | Google GenAI Key (Flash model) |
| `VITE_SUPABASE_URL` | `Your_Supabase_URL` | From Supabase Settings |
| `VITE_SUPABASE_SERVICE_KEY` | `Your_Supabase_Key` | **Note:** In production, use Anon Key if possible, or ensure RLS is strict. |

## Step 4: Configure Rewrite Rules (SPA Support)

Since this is a Single Page Application (SPA), you must tell Render to route all requests to `index.html` so React handles the routing.

1. Go to the **Redirects/Rewrites** tab.
2. Add a new rule:

| Source | Destination | Action |
| :--- | :--- | :--- |
| `/*` | `/index.html` | **Rewrite** |

**Important:** Ensure the action is set to **Rewrite**, not Redirect.

## Step 5: Deploy

1. Click **Create Static Site** (or **Manual Deploy** if already created).
2. Render will clone the repo, install dependencies, build the app, and publish it.
3. Once finished, you will see a URL like `https://kabs-quotation-app.onrender.com`.

## Troubleshooting

### Error: "Publish directory .dist does not exist!"
This error occurs if the **Publish Directory** setting in Render is incorrect.
1. Go to **Settings** in your Render Dashboard.
2. Scroll down to **Build & Deploy**.
3. Locate **Publish Directory**.
4. Ensure it is set to **`dist`** (without a dot).
5. If it is set to `.dist` or `public`, change it to `dist` and save.
6. Trigger a manual deploy.

### White Screen on Load
Check the browser console (F12). If you see errors about "API Key Missing", verify you added the Environment Variables in Step 3 correctly.

### 404 on Refresh
If you navigate to a sub-page and refresh, and get a 404, verify you added the **Rewrite Rule** in Step 4.
