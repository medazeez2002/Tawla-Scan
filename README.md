
  # Digital Cafe Menu

  This is a code bundle for Digital Cafe Menu. The original project is available at https://www.figma.com/design/F2xxTgKz9DX87l837EtuwB/Digital-Cafe-Menu.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

    ## Put It Online For Free (SSL Included)

    This project can be hosted with:
    - Frontend: Vercel (free, HTTPS included)
    - Backend API: Render (free web service, HTTPS included)

    Notes:
    - You can use free subdomains (`*.vercel.app`, `*.onrender.com`) at zero cost.
    - A custom domain (for example `yourbrand.com`) is usually paid.

    ### 1) Deploy Backend (Render)

    1. Push this repository to GitHub.
    2. In Render, create a new Web Service from your repo.
    3. Render can auto-detect settings from `render.yaml` in this project.
    4. Set environment variables in Render dashboard:
      - `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`
      - `SUPER_ADMIN_PASS`, `ADMIN_PASS`
      - `FRONTEND_URL` (set this after frontend deploy)
      - Optional Konnect keys if needed.
    5. Deploy and verify health check:
      - `https://YOUR-BACKEND.onrender.com/api/health`

    ### 2) Deploy Frontend (Vercel)

    1. Import the same GitHub repository in Vercel.
    2. Framework: Vite (auto-detected).
    3. Add environment variable:
      - `VITE_API_URL=https://YOUR-BACKEND.onrender.com`
    4. Deploy and open your app URL:
      - `https://YOUR-FRONTEND.vercel.app`

    ### 3) Lock Backend To Frontend Origin (recommended)

    After frontend deploy, set:
    - `FRONTEND_URL=https://YOUR-FRONTEND.vercel.app`

    Then redeploy backend.

    ### 4) Free SSL and Domain

    - SSL is automatic on both Vercel and Render.
    - Free domain option: keep platform subdomains.
    - Custom domain: buy domain, then connect it in Vercel (frontend) and optionally Render (API).
  