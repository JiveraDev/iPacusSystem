# iPawcus - Pet Electronic Medical Record (EMR) & Management System

iPawcus is a comprehensive management system designed for veterinary clinics and pet owners. It facilitates pet registration, medical record management, appointment bookings, and real-time queue tracking.

## 🚀 Tech Stack

- **Frontend:** React 19, Vite, Tailwind CSS, Lucide Icons
- **Backend:** PHP 8.x
- **Database:** MySQL
- **State Management:** React Hooks & LocalStorage
- **Authentication:** Custom JWT-like session management (Token-based)

## 🏗️ Core Features

### 🔐 Authentication & Role-Based Access
- **Multi-Role Support:** Specific dashboards for Pet Owners, Administrators, and Super Admins.
- **Secure Login:** Password hashing using `password_verify` in PHP.
- **Protected Routes:** Automatic redirection for unauthenticated users.

### 🐾 Pet Management
- **Centralized Registry:** Clinics can register pets with detailed profiles including species, breed, microchip, and allergies.
- **Ownership Linking:** Securely link pets to owner accounts using unique sharable IDs.
- **Medical History:** Track pet status and history before and after registration.

### 📅 Booking & Appointments
- **Service Variety:** Support for Consultations, Vaccinations, Grooming, Surgery, and more.
- **Home Services:** Option to book veterinary visits at home.
- **Payment Verification:** Integrated payment proof upload for booking confirmations.

### 🚶 Queue Management
- **Real-time Tracking:** Monitor pet status in the clinic queue (Waiting, In-Progress, Completed).
- **Priority System:** Handle urgent cases with a priority-based queue.

### 📄 Document Management
- **Consent Forms:** Manage and store digital consent files for various procedures.
- **Media Uploads:** Secure storage for pet profile images, booking concerns, and signatures.

## 📁 Project Structure

```text
├── php/                        # PHP Backend API scripts
│   ├── config.php              # Database configuration
│   ├── db.php                  # PDO database connection
│   ├── login.php               # Authentication logic
│   └── ...                     # Feature-specific API endpoints
├── src/
│   ├── components/
│   │   ├── AdminDashboards/    # Admin-specific views
│   │   ├── PetOwnerDashboard/  # Owner-specific views
│   │   └── SuperAdminDashboard/# Super Admin views
│   ├── services/               # Frontend API service layer
│   ├── ui/                     # Reusable UI components (shadcn-like)
│   └── App.jsx                 # Main application routing
├── public/                     # Static assets and uploaded media
└── tables.sql                  # Database schema definitions
```

## 🛠️ Getting Started

### Prerequisites
- PHP 8.1 or higher
- MySQL 8.0 or higher
- Node.js & npm (for frontend development)

### Local Setup

1. **Database Configuration:**
   - Create a MySQL database.
   - Import the schema from `tables.sql`.
   - Update `php/config.php` (or where database credentials are stored) with your local settings.

2. **Backend Setup:**
   - You can use the built-in PHP server for development:
     ```bash
     php -S localhost:8000 -t .
     ```
   - Ensure your `.env` file in the root has:
     ```env
     VITE_API_BASE_URL=http://localhost:8000/php
     ```

3. **Frontend Setup:**
   ```bash
   npm install
   npm run dev
   ```

## 🚢 Deployment

1. **Build the Frontend:**
   ```bash
   npm run build
   ```
2. **Transfer Files:**
   - Upload the `dist/` directory contents to your web server's public directory.
   - Upload the `php/` directory to the server.
   - Configure your web server (Apache/Nginx) to point to the `index.html` from the `dist` folder and handle PHP requests.

## 📄 License
This project is private and intended for specific clinic use.
