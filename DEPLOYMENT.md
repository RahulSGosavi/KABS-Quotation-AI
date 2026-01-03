# KABS Quotation AI Deployment Guide

This project is a React application built with Vite and TypeScript. It is containerized using Docker and is ready for deployment on platforms like Render.

## Prerequisites

- **Render Account**: [Sign up here](https://render.com/).
- **Google Gemini API Key**: [Get it here](https://ai.google.dev/).
- **Supabase Project**: [Create one here](https://supabase.com/).

## Environment Variables

You must configure the following environment variables in your deployment settings:

| Variable | Description |
| :--- | :--- |
| `API_KEY` | Your Google Gemini API Key. |
| `SUPABASE_URL` | The URL of your Supabase project. |
| `SUPABASE_SERVICE_KEY` | The Service Role Key for Supabase (allows Admin access). |

## Deployment on Render

1.  **Create a New Web Service**:
    - Go to your Render Dashboard.
    - Click **New +** -> **Web Service**.
    - Connect your GitHub repository containing this code.

2.  **Configure Service**:
    - **Name**: `kabs-quotation-ai` (or your preferred name).
    - **Runtime**: `Docker`.
    - **Region**: Select a region close to your users.
    - **Branch**: `main` (or your deployment branch).

3.  **Add Environment Variables**:
    - Scroll down to the **Environment Variables** section.
    - Click **Add Environment Variable**.
    - Add `API_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_KEY` with your actual values.

4.  **Deploy**:
    - Click **Create Web Service**.
    - Render will build the Docker image and deploy your application.

## Local Development

1.  Install dependencies:
    ```bash
    npm install
    ```

2.  Create `.env` file:
    ```bash
    cp .env.example .env
    # Edit .env and fill in your keys
    ```

3.  Run locally:
    ```bash
    npm run dev
    ```

## Database Setup

Refer to `DATABASE_SETUP.md` for the SQL scripts required to initialize your Supabase database tables and storage buckets.