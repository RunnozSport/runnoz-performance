# Runnoz Performance Tracker — Vercel Deployment Guide

## What You're Deploying

A full-stack performance tracking app for athletes to log and analyze:
- **Lift:** Barbell velocity tracking (1RM, power calculations)
- **Jump:** Vertical jump analysis (RSI, L/R symmetry)
- **Sprint:** Sprint/agility timing (acceleration profiles)
- **Features:** Live camera, video upload, data export, squad dashboard

**URL:** Will be `https://runnoz-performance.vercel.app` (customizable)

---

## Deployment Steps

### Step 1: Create GitHub Account (if not already)
1. Go to https://github.com
2. Sign up (free)
3. Verify email

### Step 2: Create GitHub Repository
1. Log in to GitHub
2. Click **+** (top right) → **New repository**
3. Name it: `runnoz-performance-tracker`
4. Description: `AI-powered performance tracking for Runnoz Sport`
5. Set to **Public** (so Vercel can access it)
6. Click **Create repository**
7. Copy the HTTPS URL (looks like: `https://github.com/yourusername/runnoz-performance-tracker.git`)

### Step 3: Push Code to GitHub
Open terminal/command prompt and run:

```bash
# Navigate to the project folder
cd /path/to/runnoz-performance

# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: Runnoz Performance Tracker MVP"

# Add GitHub remote (replace URL with your repo URL)
git remote add origin https://github.com/yourusername/runnoz-performance-tracker.git

# Push to GitHub
git branch -M main
git push -u origin main
```

**Note:** If you get auth errors, use a GitHub personal access token:
1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token with `repo` scope
3. Use token as password when prompted

### Step 4: Deploy to Vercel
1. Go to https://vercel.com
2. Click **Sign Up** (or sign in if you have account)
3. Choose **Continue with GitHub**
4. Authorize Vercel to access your GitHub account
5. Click **Import Project**
6. Paste your GitHub repo URL OR select from dropdown
7. Click **Import**
8. Vercel auto-detects Next.js (correct framework)
9. Click **Deploy**

**Wait 2-3 minutes for build...**

### Step 5: Celebrate 🎉
Once deployment completes:
- You'll see a success message
- Vercel generates a **Live URL** (e.g., `https://runnoz-performance.vercel.app`)
- Click the URL to view your app

---

## Custom Domain (Optional)

If you want to use a custom domain like `performance.runnozsport.com`:

1. Go to your Vercel project dashboard
2. Click **Settings** → **Domains**
3. Enter your domain name
4. Follow instructions to update DNS records in your domain provider (Namecheap, GoDaddy, etc.)
5. Wait 24-48 hours for DNS propagation

---

## Updating the App (After Deployment)

Future changes are automatic:

1. Make changes locally
2. `git add .`
3. `git commit -m "Update description"`
4. `git push origin main`
5. Vercel auto-redeploys (2-3 min)

---

## Important: Camera Access

The app needs **HTTPS** for camera access. Vercel provides this automatically for `*.vercel.app` URLs.

**On first load:**
- Browser will ask for camera permission
- Click **Allow**
- You'll see the live camera feed

---

## First-Time Usage

### Adding an Athlete
1. Enter name in header (defaults to "Athlete 1")
2. Switch to Lift/Jump/Sprint tabs
3. Log a session
4. Data auto-saves to browser

### Exporting Data
1. Log some sessions
2. Click **Export CSV** in header
3. Opens CSV file (download to computer)
4. Can import to Excel/Google Sheets for analysis

### Viewing Dashboard
- Click **Dashboard** tab
- Shows overview of all sessions
- Charts update as you log data

---

## Troubleshooting

### Deploy failed
- Check GitHub push was successful (`git log` shows your commits)
- Vercel shows build errors in dashboard → click error to see details
- Most common: missing files or package install issues
- Solution: Delete project on Vercel, push again, redeploy

### Camera not working
- Make sure you're on HTTPS (Vercel URL is auto-HTTPS)
- Check browser permissions (Chrome: address bar 🔒 → Site settings → Camera)
- Try different browser or clear cache

### Data not saving
- Check browser's developer console (F12 → Console tab) for errors
- Try clearing localStorage: F12 → Application → Storage → Clear all
- Data is stored locally in browser (not cloud)

### Need to roll back?
1. Check previous commits: `git log`
2. Revert to old version: `git revert [commit-hash]`
3. `git push origin main`
4. Vercel redeploys old version

---

## Customization

### Change App Colors
Edit `/app/page.tsx`, find `styles` object:
```javascript
'--runnoz-red': '#FF5C4D',    // Change to your color hex
'--runnoz-navy': '#0F1E3D',   // Change to your color hex
```

### Change App Name
Edit `/app/layout.tsx`:
```javascript
export const metadata: Metadata = {
  title: 'Your Custom Title',  // Change this
  description: 'Your description',
}
```

### Add More Athletes
The app supports unlimited athletes. Just switch the athlete name in header and log sessions for different people.

---

## Security Notes

- ✅ App runs entirely in browser (no server-side data storage)
- ✅ Camera feed never sent to servers (local processing only)
- ✅ All data stored in browser's localStorage
- ✅ Export CSV to keep offline backup
- ⚠️ Clearing browser data = loses all sessions (keep CSV backups!)

---

## Next Steps

1. **Deploy** (follow steps above)
2. **Test** on your phone with live camera
3. **Log some sessions** to verify data saves
4. **Export CSV** to confirm data export works
5. **Share URL** with athletes/coaches
6. **Collect feedback** for improvements

---

## Need Help?

- **Vercel docs:** https://vercel.com/docs
- **Next.js docs:** https://nextjs.org/docs
- **Git help:** https://git-scm.com/doc

---

**Estimated time: 30-45 minutes from start to live URL**

Good luck! 🚀
