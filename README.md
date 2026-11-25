# Wixfix — EdTech & Web Development Agency Website

**Wixfix** is a dynamic Python (Flask) web application for an EdTech and Web Development agency led by **Priya Gupta**, designed with a clean white freelancing-marketplace layout and academic navy/teal/amber accents. It runs locally and is ready for **Vercel Python** deployment.

## Core Purpose & Offerings

- **Structured Learning Portals**: Turns scattered YouTube educational videos into clean, topic-wise websites paired with concise descriptions and official study items from **MSDN**, **AWS**, and **GCP**.
- **School Services (Free\*)**: Free initial school-level educational resources and organized topic lists.
- **Premium / Speaker-Led Learning**: Affordable, personalized, speaker-style advanced learning modules.
- **Custom Applications\***: Tailored web applications built from customer descriptions and uploaded wireframes (*charged according to customer needs*).

## Key Features

- **Marketplace-Style White Theme**: Sticky navigation header, hero callouts, scrollable left workspace sidebar, and dynamic middle workspace panels.
- **Sample Websites Created by Us (Real-Time Sync)**:
  - Interactive middle dashboard showcase and footer **Featured Sample Websites** list.
  - Priority tags (`Featured`, `High`, `Standard`) control display ordering; clicking any site opens it in a new tab.
  - Updates made in the **Admin Panel** immediately sync to both the middle dashboard and the footer across all pages.
- **Post Need & Wireframe Workspace**:
  - Authenticated users can submit a project description and upload a wireframe (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`, `.pdf`).
  - **Role-Based Ownership**: Members can edit or delete only their own posts. Logging in with the owner email (`anooppriyaranjan@gmail.com`) or unlocking the Admin Panel grants full edit/delete permissions across all posts.
  - **Admin-Only Running App URL**: Only administrators can attach the running web application URL to a project post, which displays an embedded live preview alongside an **Open Live Web App in New Tab** button.
- **User Launch Login Popup & Registration (`/register`)**:
  - Prompts unauthenticated visitors on initial launch with a direct registration link below the password field.
  - Registration collects First Name, Last Name, Email ID, Mobile Number, Password, and Confirm Password, persisted in JSON storage.
- **Contact Us & Office Locations (`/contact`)**:
  - Dedicated contact page linked from the header and footer of every page, featuring an inquiry form and official company details (New Delhi & Varanasi offices).
- **Google-Style Hover Chatbot**:
  - Minimized in the bottom-right corner; expands smoothly on mouse hover or click to answer questions about Wixfix services, pricing\*, MSDN/AWS/GCP study hubs, wireframes, and office locations.
- **Security**:
  - User passwords and administrator access are verified server-side using one-way salted `PBKDF2-HMAC-SHA256` cryptographic hashing (`200,000` iterations) with constant-time comparison (`hmac.compare_digest`). No plaintext passwords are stored or disclosed in the codebase or documentation.

## Project Structure

```text
COMPANY_WEBSITE/
├── api/
│   └── index.py            # Vercel Python WSGI entrypoint
├── app.py                  # Flask server, API routes, PBKDF2 auth, JSON persistence
├── vercel.json             # Vercel rewrite routing to Python entrypoint
├── requirements.txt        # Production Python dependencies (Flask, Werkzeug)
├── requirements-dev.txt    # Local development & test dependencies (pytest)
├── README.md               # Project documentation
├── data/
│   └── app_data.json       # Bundled JSON store (samples, posts, users, inquiries)
├── static/
│   ├── css/style.css       # Responsive white marketplace & academic theme
│   ├── js/app.js           # Dynamic panels, real-time sync, hover chatbot, forms
│   ├── img/                # Default SVG wireframe asset
│   └── uploads/wireframes/ # Local uploaded wireframe files
├── templates/
│   ├── base.html           # Shared header, footer, login/admin modals, chatbot
│   ├── index.html          # Home page, left scrollable menu, dynamic workspace
│   ├── register.html       # User registration page
│   └── contact.html        # Contact form & New Delhi / Varanasi office details
└── tests/
    └── test_app.py         # Automated pytest suite
```

## Run Locally

1. **Install dependencies** (Python 3.10+):
   ```powershell
   pip install -r requirements-dev.txt
   ```

2. **Start the website**:
   ```powershell
   python app.py
   ```

3. **Open in your browser**:
   Visit `http://127.0.0.1:5000`

4. **Run automated tests**:
   ```powershell
   python -m pytest -v
   ```

## Deploy to Vercel (Python Runtime)

1. Push this folder to GitHub/GitLab/Bitbucket, or deploy with the Vercel CLI (`vercel --prod`).
2. Vercel automatically detects `vercel.json`, `api/index.py`, and `requirements.txt` and builds the Flask app in the Python runtime.
3. *(Recommended)* Add a `SECRET_KEY` environment variable in **Vercel Project Settings -> Environment Variables** so user/admin sessions remain valid across serverless cold starts.
4. **Storage Note on Vercel**: Because Vercel's deployment bundle is read-only, `app.py` automatically seeds `data/app_data.json` into `/tmp/wixfix_runtime/` when running on Vercel. Note that `/tmp` is ephemeral across cold starts; for durable cloud persistence across deployments, connect an external JSON/KV store or database.
