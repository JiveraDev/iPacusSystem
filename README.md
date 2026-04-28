# Pet EMR - Management System

A comprehensive React + Node.js system for pet medical records and owner management.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- MySQL Database

### Installation
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your `.env` file (see `.env.example`)
4. Start the server:
   ```bash
   npm run server
   ```
5. Start the frontend:
   ```bash
   npm run dev
   ```

## 🏗️ Core Features

### 🔐 Session & Role Control
- **Protected Routes:** Automatic redirection to login for unauthenticated users.
- **Role-Based Access (RBAC):** Dashboard components are restricted by user role (Standard: `Pet Owner`).
- **Persistent Sessions:** State is maintained via `localStorage` and verified by the backend.

### 🐾 Pet Management
- **Registration:** Clinics can register pets with full medical history.
- **One-Pet-One-Owner:** Strict database constraint ensures each pet is linked to exactly one account.
- **Smart Linking:** Owners link pets using a hashed Registration ID (e.g., `PET-1-IPAWCUS`).
- **Lazy Age Updates:** The system automatically calculates and updates pet ages in the database whenever a record is fetched.

### 🖼️ Media & Security
- **Secure Uploads:** Pet profile pictures are hashed using SHA-256 to hide original filenames.
- **Storage:** Images are stored in `server/uploads/profile/` and served statically.
- **Optional Workflow:** Image upload is optional during registration to ensure zero friction.

## 📁 Project Structure
- `/src/components/PetOwnerDashboard`: Protected dashboard views.
- `/src/services`: Centralized API logic (Linking, Finding, Registration).
- `/server`: Node.js API logic and Database Pool.
- `/server/uploads/profile`: Secure storage for hashed profile images.

## 🛠️ Tech Stack
- **Frontend:** React, Tailwind CSS, Lucide Icons, Shadcn/UI
- **Backend:** Node.js, Express, Multer
- **Database:** MySQL

## SHIFTING FROM NODE/EXPRESS TO LARAVEL

✦ To start the backend server in the future, follow these steps:

1. Open your terminal.
2. Navigate to the project folder:

1     cd C:\Users\Admin\WebstormProjects\untitled1\laravel-api
3. Run the server command:
   1     php artisan serve --port=3001

Pro Tip: You can keep this terminal window open in the background while you work on
the frontend. If you ever need to stop the server, just press Ctrl + C in that
terminal window.

## php artisan  config:clear 
command is used in Laravel applications to
remove the cached configuration files.

When Laravel is running, it often caches its configuration to improve
performance. However, if you update your .env file or change configuration
files directly, these changes won't be reflected until the cache is cleared.
Running config:clear deletes this cache, forcing Laravel to re-read your
configuration and .env file the next time it needs them.
