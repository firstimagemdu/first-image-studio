FIRST IMAGE STUDIO ERP — A TO Z CLOUD DEPLOYMENT BUNDLE
=======================================================

Everything included and pre-configured:
1. server.js — Node.js cloud server with automatic DATA_DIR detection, rotating server snapshots (every 15m + on write) in DATA_DIR/backups/, /api/health, /api/studio-data, /api/studio-backup, and admin OTP recovery endpoints.
2. package.json — Node.js >=18 start configuration (npm start).
3. render.yaml — Render web service + persistent disk mount (/opt/render/project/src/data) + DATA_DIR & MAX_BACKUPS env vars.
4. railway.json & Procfile — Railway / PaaS deployment configuration.
5. Dockerfile — Container deployment configuration.
6. public/index.html & First_Image_Studio_ERP_v70.html — Full ERP app with Tamil WhatsApp PDF bill sharing and automatic 10-minute client snapshot/JSON backup.
7. .env.example & data/studio_state.json — Environment template and initial data directory.

Quick Deploy Steps:
1. Extract First_Image_Studio_Cloud_Deploy_A_to_Z.zip.
2. Upload/push files to GitHub or your cloud provider.
3. Deploy with Build Command: npm install and Start Command: npm start.
4. Attach a Persistent Disk on your cloud host and point DATA_DIR to its mount path so data survives restarts/redeploys.
