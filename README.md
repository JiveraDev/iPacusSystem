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
