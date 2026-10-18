# Mike Kelly Donkoh — Developer Portfolio & Admin Manager

Personal portfolio with multi-page navigation, dynamic project management, SEO optimization for Google indexing, and ready-to-deploy Google Cloud configuration.

---

## 🚀 How to Launch on Google

### Option 1: Launch on Google Cloud Run (Recommended for Container/Server)
1. Install the [Google Cloud SDK](https://cloud.google.com/sdk/docs/install).
2. Authenticate and set your project:
   ```bash
   gcloud auth login
   gcloud config set project YOUR_GOOGLE_CLOUD_PROJECT_ID
   ```
3. Deploy to Google Cloud Run in one command:
   ```bash
   gcloud run deploy portfolio --source . --region us-central1 --allow-unauthenticated
   ```
4. Google Cloud will output your live URL (e.g. `https://portfolio-xyz.a.run.app`).

---

### Option 2: Launch on Google App Engine
1. Deploy directly using the provided `app.yaml`:
   ```bash
   gcloud app deploy
   ```
2. Open your live app:
   ```bash
   gcloud app browse
   ```

---

### Option 3: Free Static Hosting (GitHub Pages / Vercel / Netlify / Firebase)
1. Push the contents of the `public/` directory or the repository to GitHub.
2. For Vercel/Netlify, import the repository with default settings.
3. The site includes automatic static JSON fallbacks (`/api/projects.json`) so projects render cleanly on any static server.

---

## 🔍 Getting Indexed on Google Search (Google Search Console)

1. **Submit Domain to Google Search Console**:
   - Go to [Google Search Console](https://search.google.com/search-console).
   - Add your live domain (`https://yourdomain.com`).

2. **Submit Sitemap**:
   - In Search Console, navigate to **Sitemaps**.
   - Enter `sitemap.xml` and click **Submit**.
   - Googlebot will automatically crawl all 6 pages (`/`, `/about`, `/skills`, `/projects`, `/services`, `/contact`).

3. **SEO Features Included**:
   - **`sitemap.xml`**: Pre-configured XML sitemap for all pages.
   - **`robots.txt`**: Crawl instructions allowing public pages and protecting `/admin`.
   - **Schema.org JSON-LD**: Structured `Person` schema for rich Google search cards.
   - **Open Graph & Twitter Cards**: High-impact social media previews with your default profile photo.
   - **Favicon**: Crisp SVG favicon badge for browser tabs and Google Search result rows.

---

## 💻 Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   ```bash
   copy .env.example .env
   ```

3. **Start the server**:
   ```bash
   npm start
   ```

4. **Access the application**:
   - Website: `http://localhost:3000`
   - Admin Panel: `http://localhost:3000/admin` (Default user: `admin`, password in `.env`)
