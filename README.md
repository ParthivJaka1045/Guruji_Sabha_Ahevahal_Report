# 🚀 SMVS Guruji Sabha Report Portal — Ubuntu & Docker Deployment Guide

## 📋 1. Application Overview
The **SMVS Report Portal** is a production-ready Web Application built with:
- **Backend**: Node.js (Express.js)
- **Database**: SQLite (`smvs.sqlite`) with high-performance pure relational schema & foreign keys
- **Frontend**: Responsive UI (Bootstrap 5, Vanilla JS, Hind Vadodara Gujarati typography, Multi-CDN FontAwesome 6)
- **Document Generators**: Client-side PDF (`html2pdf.js`) and Word (`html-docx-js`) export
- **Authentication**: JWT & Cookie-based secure auth with bcrypt password hashing

---

## 📦 2. Production Files Provided
When extracting the ZIP file or cloning the repository, you have:
| File / Folder | Purpose |
|---|---|
| `server.js` | Main Express server & REST API endpoints |
| `public/` | Frontend assets (HTML, CSS, JS, Logos, Favicon) |
| `smvs.sqlite` | Relational SQLite Database (Pre-seeded with 108 reports, 6 categories, 52 centers, admin/user accounts) |
| `Dockerfile` | Docker image build configuration |
| `docker-compose.yml` | One-command container launcher with persistent database volume |
| `package.json` | Node.js dependencies and start scripts |
| `.env.example` | Environment variable template |

---

## 🐳 3. Method A: Deployment via Docker & Docker-Compose (Recommended)

### Prerequisites on Ubuntu Server:
```bash
# 1. Update Ubuntu packages
sudo apt update && sudo apt upgrade -y

# 2. Install Docker and Docker Compose
sudo apt install -y docker.io docker-compose-plugin
sudo systemctl enable --now docker
```

### Deployment Steps:
```bash
# 1. Place the project files in your server directory (e.g., /var/www/smvs-report)
mkdir -p /var/www/smvs-report
cd /var/www/smvs-report

# 2. Unzip the code (or git clone)
# unzip SMVS_Report_App_Production.zip

# 3. Create .env file (optional custom secret)
cp .env.example .env

# 4. Build and start the container in background
sudo docker compose up -d --build
```

### Managing the Container:
```bash
# View live logs:
sudo docker compose logs -f

# Check container status:
sudo docker compose ps

# Restart the application:
sudo docker compose restart

# Stop the application:
sudo docker compose down
```

> 💡 **Database Persistence:** The `docker-compose.yml` is pre-configured with volume mapping (`./smvs.sqlite:/app/smvs.sqlite`). Any new report or user added is saved directly on the Ubuntu server host disk.

---

## ⚙️ 4. Method B: Direct Deployment on Ubuntu (Node.js + PM2)

If you prefer running without Docker:

```bash
# 1. Install Node.js 20 LTS & PM2
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs build-essential python3
sudo npm install -g pm2

# 2. Navigate to project folder
cd /var/www/smvs-report

# 3. Install production dependencies
npm ci --omit=dev

# 4. Start app with PM2 process manager
pm2 start server.js --name "smvs-report"

# 5. Enable auto-start on server reboot
pm2 startup
pm2 save
```

---

## 🌐 5. Nginx Reverse Proxy & Free SSL Setup (Custom Domain)

To bind your domain (e.g. `report.smvs.org` or `smvs-report.yourdomain.com`) to port 3000:

```bash
# 1. Install Nginx and Certbot
sudo apt install -y nginx certbot python3-certbot-nginx

# 2. Create Nginx configuration
sudo nano /etc/nginx/sites-available/smvs-report
```

Paste the following Nginx configuration:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# 3. Enable site & test configuration
sudo ln -s /etc/nginx/sites-available/smvs-report /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# 4. Install Free SSL Certificate (HTTPS)
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## 💾 6. Database Backup Strategy

All application data is inside a single self-contained file: `smvs.sqlite`.

### Manual Backup:
```bash
# Create an instant timestamped backup
cp smvs.sqlite /var/backups/smvs_backup_$(date +%Y%m%d_%H%M%S).sqlite
```

### Automated Daily Cron Backup:
Add this line to `crontab -e` to take daily midnight backups:
```bash
0 0 * * * cp /var/www/smvs-report/smvs.sqlite /var/backups/smvs_$(date +%F).sqlite
```

---

## 🔑 7. Default Admin & User Credentials

| Role | Username / Email | Password | Access Level |
|---|---|---|---|
| 👑 **Administrator** | `admin@smvs.org` (or `admin`) | `Admin@2026` | Full CRUD + Location/Category/User Masters + History + PDF/Word |
| 👤 **Standard User** | `user@smvs.org` (or `user`) | `User@2026` | Create Reports + View History + PDF/Word |

---

## 📞 Support & Maintenance
- **Database Engine**: `better-sqlite3` with `journal_mode = DELETE` (zero lockups, single file persistence).
- **Static Assets**: Automatically served by Express from `/public`.
