# Pet EMR - Management System

A comprehensive React + Node.js system for pet medical records and owner management.

## 🚀 Getting Started

### Prerequisites
- NPMs 
- MySQL Database
- PHP 8.3


## 🏗️ Core Features

### 🔐 Session & Role Control
- **Protected Routes:** Automatic redirection to login for unauthenticated users.
- **Role-Based Access (RBAC):** Dashboard components are restricted by user role (Standard: `Pet Owner`).
- **Persistent Sessions:** State is maintained via `localStorage` and verified by the backend.

### 🐾 Pet Management
- **Registration:** Clinics can register pets with full medical history.
- **One-Pet-One-Owner:** Strict database constraint ensures each pet is linked to exactly one account.
- **Smart Linking:** Owners link pets using a hashed Registration ID (e.g., `PET-1-IPAWCUS`).

### 🖼️ Media & Security
- **Secure Uploads:** Pet profile pictures are hashed using SHA-256 to hide original filenames.

## 📁 Project Structure
- `/src/components/PetOwnerDashboard`: Protected dashboard views.
- `/src/services`: Centralized API logic (Linking, Finding, Registration).
- `/server`: Node.js API logic and Database Pool.
- `/server/uploads/profile`: Secure storage for hashed profile images.


If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.


## Test Command

   ```
     php -S localhost:8000 php/index.php 
     //for server 
     
     npm run dev 
     // for pages react vite to work.... 
   ```


How to test it locally right now:

To verify this works before you upload it to Hostinger, follow these steps:

1. Start the PHP Backend:
   Open a new terminal and run this command:
 
2. localhost:8000 php/index.php
   (This starts a tiny PHP server on port 8000).

2. Update your .env file:
   Change your VITE_API_BASE_URL to point to the new PHP server:

       VITE_API_BASE_URL=http://localhost:8000

3. Run your Frontend:
   In your usual terminal, run:
   1     npm run dev

4. Test:
   Go to your browser and try to log in or register. The frontend will now be talking to your PHP code instead of Node.js.

When you are ready for Hostinger:
You just need to upload the php/ folder, the .htaccess file, and your built frontend files (dist/ folder) to your Hostinger public_html directory.

