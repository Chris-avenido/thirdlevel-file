# Technical Documentary: Isolated Server Deployment (`insighted-deped-mgmnt`)

**Date:** 2026-04-27  
**Status:** Live & Isolated  
**Target URL:** [https://stride.deped.gov.ph/insighted-deped-mgmnt/](https://stride.deped.gov.ph/insighted-deped-mgmnt/)

---

## 🎯 Executive Summary
This document outlines the architectural and infrastructure steps taken to deploy a dedicated, isolated instance of the InsightEd application for the Department of Education Management (`deped-mgmnt`). The deployment was designed with a "Safety Isolation" philosophy to ensure zero interference with existing production (Port 5000) and staging (Port 5001) environments.

## 🏗️ Isolated Architecture

### 1. Dedicated Filesystem Silo
The application is served from a dedicated subdirectory on the Azure VM.
- **Root Path:** `/var/www/html/InsightEd-Mobile-PWA/deped-mgmnt/`
- **Application Files:** Contains a full self-contained copy of the Node.js API, built Frontend assets, and configuration files.

### 2. Network Port Isolation
To prevent process contention, the backend service was assigned a unique, non-conflicting port.
- **Isolated Backend Port:** `5005`
- **PM2 Process Name:** `insighted-deped-mgmnt-backend`

### 3. Frontend Base-Path Hardening
The Vite build configuration was modified to allow the application to correctly resolve assets within the subpath.
- **Config Change:** `vite.config.js` -> `base: '/insighted-deped-mgmnt/'`
- **Impact:** All internal references to scripts, styles, and images are prefixed with the correct subpath.

---

## 🛠️ Step-by-Step Deployment Procedure

### Phase 1: Local Build & Preparation
1.  **Vite Build:** Ran `npm run build` with the updated base path.
2.  **Config Generation:** Created a dedicated `ecosystem.deped-mgmnt.config.cjs` configured for port 5005.
3.  **Archiving:** Compressed `api`, `dist`, `public`, and configuration scripts into `deped-mgmnt-deploy.tmp.tar.gz`.

### Phase 2: Remote Infrastructure Setup
1.  **Directory Creation:** Created the target directory using `ssh`.
2.  **Archive Sync:** Transferred the archive to the VM using `scp` (leveraging pre-configured SSH keys).
3.  **Remote Extraction:** Unpacked the archive in the dedicated subdirectory.
4.  **Environment Sync:** Copied the existing production `.env` to the new instance to inherit database credentials without modification.

### Phase 3: Nginx Integration (Surgical Method)
To avoid overwriting the entire production config, location blocks were surgically inserted into `/etc/nginx/sites-enabled/stride.conf`:

```nginx
# Isolated Location Blocks
location /insighted-deped-mgmnt/ {
    alias /var/www/html/InsightEd-Mobile-PWA/deped-mgmnt/dist/;
    try_files $uri $uri/ /insighted-deped-mgmnt/index.html;
}

location /insighted-deped-mgmnt/api/ {
    proxy_pass http://127.0.0.1:5005/api/;
    # ... timeout optimizations
}
```

### Phase 4: Activation & Health Validation
1.  **Nginx:** Validated configuration via `sudo nginx -t` and reloaded with `sudo systemctl reload nginx`.
2.  **Backend:** Initialized the PM2 process using the dedicated ecosystem config.
3.  **Port Scan:** Verified port `5005` is LISTENing and and isolated from ports `5000` and `5001`.

---

## 🛡️ Maintenance & Scaling
- **Restarting the service:** `pm2 restart insighted-deped-mgmnt-backend`
- **Viewing logs:** `pm2 logs insighted-deped-mgmnt-backend`
- **Updating the code:** Rerun the `deploy-deped-mgmnt.js` script from the local machine.

---
**Custodian:** Master Librarian  
**Security Tier:** Isolated Infrastructure  
