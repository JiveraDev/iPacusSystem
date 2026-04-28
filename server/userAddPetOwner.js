import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { pool } from "./db.js";
import { loginUser } from "./userFind.js";
import { upload } from "./uploadConfig.js";
import path from "path";

dotenv.config();

const userAddPetOwner = express();

// Serve static files from the uploads directory
userAddPetOwner.use("/uploads", express.static(path.join(process.cwd(), "server/uploads")));

/**
 * Calculates pet age based on birth date (Matches frontend logic)
 */
function calculateAge(birthDate) {
    if (!birthDate) return "";
    const birth = new Date(birthDate);
    const now = new Date();
    
    let years = now.getFullYear() - birth.getFullYear();
    let months = now.getMonth() - birth.getMonth();
    let days = now.getDate() - birth.getDate();

    if (days < 0) {
        months -= 1;
        const lastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        days += lastMonth.getDate();
    }
    
    if (months < 0) {
        years -= 1;
        months += 12;
    }

    const plural = (count, unit) => `${count} ${unit}${count > 1 ? "s" : ""}`;

    if (years > 0) {
        return months > 0 
            ? `${plural(years, "year")} and ${plural(months, "month")}` 
            : plural(years, "year");
    }
    
    if (months > 0) {
        const weeks = Math.floor(days / 7);
        return weeks > 0 
            ? `${plural(months, "month")} and ${plural(weeks, "week")}` 
            : plural(months, "month");
    }
    
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    const totalDays = Math.floor((now.getTime() - birth.getTime()) / millisecondsPerDay);

    if (totalDays >= 7) {
        const weeks = Math.floor(totalDays / 7);
        const remDays = totalDays % 7;
        return remDays > 0 
            ? `${plural(weeks, "week")} and ${plural(remDays, "day")}` 
            : plural(weeks, "week");
    }
    
    return totalDays > 0 ? plural(totalDays, "day") : "Newborn";
}

const PORT = Number(process.env.PORT);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN;

userAddPetOwner.use(cors({ origin: FRONTEND_ORIGIN || true }));
userAddPetOwner.use(express.json());

// Request logger
userAddPetOwner.use((req, res, next) => {
    // console.log(`${req.method} ${req.url}`);
    next();
});

userAddPetOwner.get("/api/health", async (_req, res) => {
    try {
        await pool.query("SELECT 1");
        // Ensure Pet_Ownership table exists with strict one-owner-per-pet constraint
        await pool.query(`
            CREATE TABLE IF NOT EXISTS Pet_Ownership (
                link_id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                pet_id INT,
                linked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id),
                FOREIGN KEY (pet_id) REFERENCES pets_information(pet_id),
                UNIQUE KEY unique_pet_owner (pet_id)
            )
        `);
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ ok: false, message: error.message });
    }
});

userAddPetOwner.get("/api/test", (req, res) => {
    res.json({ message: "Server is working!" });
});

// Single file upload endpoint
userAddPetOwner.post("/api/upload", upload.single("image"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: "No file uploaded." });
    }
    
    // Return the relative URL to be stored in DB
    const fileUrl = `/uploads/profile/${req.file.filename}`;
    res.json({ url: fileUrl });
});

userAddPetOwner.post("/api/users", async (req, res) => {
    const {
        email,
        password,
        role,
        firstName,
        lastName,
        address,
        phoneNumber,
        emergencyContact,
    } = req.body;

    if (!email || !password || !firstName || !lastName || !address || !phoneNumber) {
        res.status(400).json({ message: "Missing required user fields." });
        return;
    }

    try {
        const [existingUsers] = await pool.query(
            "SELECT user_id FROM users WHERE mail_Address = ? LIMIT 1",
            [email]
        );

        if (existingUsers.length > 0) {
            res.status(409).json({ message: "Email already exists." });
            return;
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const [result] = await pool.query(
            `INSERT INTO users
                (mail_Address, user_password, role, first_name, last_name, personal_Address, phoneNumber, emergencyNumber)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                email,
                passwordHash,
                role,
                firstName,
                lastName,
                address,
                phoneNumber,
                emergencyContact || null,
            ]
        );

        res.status(201).json({
            id: result.insertId,
            message: "User created successfully.",
        });
    } catch (error) {
        res.status(500).json({ message: error.message || "Failed to create user." });
    }
});

userAddPetOwner.post("/api/login", loginUser);

// Get all pets (existing)
userAddPetOwner.get("/api/pet_information", async (req, res) => {
    try {
        const [pets] = await pool.query(
            "SELECT * FROM pets_information ORDER BY pet_id DESC"
        );
        
        const processedPets = await Promise.all(pets.map(async (pet) => {
            const currentAge = calculateAge(pet.pet_BDAY);
            
            // Lazy Update: If stored age is different from calculated age, update DB
            if (currentAge !== pet.pet_age) {
                await pool.query(
                    "UPDATE pets_information SET pet_age = ? WHERE pet_id = ?",
                    [currentAge, pet.pet_id]
                );
            }

            return {
                id: pet.pet_sharable_ID,
                dbId: pet.pet_id,
                petName: pet.pet_name,
                species: pet.pet_species,
                breed: pet.pet_breed,
                birthDate: pet.pet_BDAY,
                status: pet.pet_status,
                age: currentAge,
                gender: pet.pet_gender,
                weight: pet.pet_weight,
                microchipNumber: pet.pet_microchip,
                tempOwnerName: pet.pet_Temp_owner,
                allergies: pet.pet_allergies,
                colorMarkings: pet.pet_color_marking
            };
        }));

        res.json(processedPets);
    } catch (error) {
        res.status(500).json({ message: error.message || "Failed to fetch pets." });
    }
});

// Link a pet to a user
userAddPetOwner.post("/api/pet_ownership/link", async (req, res) => {
    const { userId, sharableId } = req.body;
    console.log(`Attempting to link pet. UserID: ${userId}, SharableID: ${sharableId}`);

    if (!userId || !sharableId) {
        res.status(400).json({ message: "userId and sharableId are required." });
        return;
    }

    try {
        // 1. Find user's name to update the pet record
        const [users] = await pool.query(
            "SELECT first_name, last_name FROM users WHERE user_id = ?",
            [userId]
        );

        if (users.length === 0) {
            res.status(404).json({ message: "User not found." });
            return;
        }

        const ownerFullName = `${users[0].first_name} ${users[0].last_name}`;

        // 2. Find pet by sharableId
        const [pets] = await pool.query(
            "SELECT pet_id, pet_name FROM pets_information WHERE pet_sharable_ID = ?",
            [sharableId]
        );

        console.log(`Pet search result for ${sharableId}:`, pets);

        if (pets.length === 0) {
            console.log(`Pet not found with SharableID: ${sharableId}`);
            res.status(404).json({ message: `Pet not found with ID: ${sharableId}` });
            return;
        }

        const petId = pets[0].pet_id;
        console.log(`Found pet: ${pets[0].pet_name} (DB ID: ${petId}). Updating owner to: ${ownerFullName}`);

        // 3. Check if this pet is already owned by someone else
        const [existingOwnership] = await pool.query(
            "SELECT user_id FROM Pet_Ownership WHERE pet_id = ?",
            [petId]
        );

        if (existingOwnership.length > 0) {
            // Check if the existing owner is NOT the current user
            if (existingOwnership[0].user_id !== parseInt(userId)) {
                return res.status(409).json({ 
                    message: "This pet is already registered to another owner. Please contact the clinic if this is an error." 
                });
            }
        }

        // 4. Update the pet's owner name in pets_information
        await pool.query(
            "UPDATE pets_information SET pet_Temp_owner = ? WHERE pet_id = ?",
            [ownerFullName, petId]
        );

        // 5. Link (using INSERT IGNORE or handled by UNIQUE KEY)
        try {
            await pool.query(
                "INSERT IGNORE INTO Pet_Ownership (user_id, pet_id) VALUES (?, ?)",
                [userId, petId]
            );
            res.status(201).json({ message: "Pet linked successfully and owner name updated." });
        } catch (err) {
            console.error("Database error during linking:", err);
            res.status(500).json({ message: "Failed to create ownership record." });
        }
    } catch (error) {
        console.error("Error in /api/pet_ownership/link:", error);
        res.status(500).json({ message: error.message || "Failed to link pet." });
    }
});

// Get pets for a specific user
userAddPetOwner.get("/api/users/:userId/pets", async (req, res) => {
    const { userId } = req.params;

    try {
        const [pets] = await pool.query(
            `SELECT p.* 
             FROM pets_information p
             JOIN Pet_Ownership po ON p.pet_id = po.pet_id
             WHERE po.user_id = ?`,
            [userId]
        );

        const processedPets = await Promise.all(pets.map(async (pet) => {
            const currentAge = calculateAge(pet.pet_BDAY);
            
            // Lazy Update
            if (currentAge !== pet.pet_age) {
                await pool.query(
                    "UPDATE pets_information SET pet_age = ? WHERE pet_id = ?",
                    [currentAge, pet.pet_id]
                );
            }

            return {
                id: pet.pet_sharable_ID,
                dbId: pet.pet_id,
                name: pet.pet_name,
                species: pet.pet_species,
                breed: pet.pet_breed,
                birthDate: pet.pet_BDAY,
                status: pet.pet_status,
                age: currentAge,
                gender: pet.pet_gender,
                weight: pet.pet_weight,
                microchipId: pet.pet_microchip,
                allergies: pet.pet_allergies,
                color: pet.pet_color_marking,
                profileImage: pet.pet_profile_image || ""
            };
        }));

        res.json(processedPets);
    } catch (error) {
        res.status(500).json({ message: error.message || "Failed to fetch user pets." });
    }
});

userAddPetOwner.post("/api/pet_information", async (req, res) => {
    const {
        petName,
        species,
        breed,
        birthDate,
        status,
        age,
        gender,
        weight,
        microchipNumber,
        tempOwnerName,
        allergies,
        colorMarkings,
        currentMedication,
        veterinarianNotes,
        lastVisitDate
    } = req.body;

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Insert into pets_information (without sharableId first)
        const [petResult] = await connection.query(
            `INSERT INTO pets_information 
            (pet_name, pet_species, pet_breed, pet_BDAY, pet_status, pet_age, pet_gender, pet_weight, pet_microchip, pet_Temp_owner, pet_allergies, pet_color_marking, pet_profile_image)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                petName,
                species,
                breed,
                birthDate,
                status || 'Healthy',
                age || null,
                gender,
                weight || 0,
                microchipNumber || null,
                tempOwnerName || null,
                allergies || null,
                colorMarkings || null,
                req.body.profileImage || null
            ]
        );

        const petId = petResult.insertId;
        const sharableId = `PET-${petId}-IPAWCUS`;

        // 2. Update with generated sharableId
        await connection.query(
            "UPDATE pets_information SET pet_sharable_ID = ? WHERE pet_id = ?",
            [sharableId, petId]
        );

        // 3. Insert into history_before_registration
        await connection.query(
            `INSERT INTO history_before_registration
            (current_medication, veterinarian_notes, pet_id, last_visit_Date)
            VALUES (?, ?, ?, ?)`,
            [
                currentMedication || null,
                veterinarianNotes || null,
                petId,
                lastVisitDate || null
            ]
        );

        await connection.commit();
        res.status(201).json({ 
            id: petId, 
            sharableId: sharableId,
            message: "Pet registered successfully." 
        });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ message: error.message || "Failed to register pet." });
    } finally {
        connection.release();
    }
});

// Get a single pet by sharable ID
userAddPetOwner.get("/api/pet_information/:id", async (req, res) => {
    const { id } = req.params; // sharable ID

    try {
        const [pets] = await pool.query(
            "SELECT * FROM pets_information WHERE pet_sharable_ID = ?",
            [id]
        );

        if (pets.length === 0) {
            res.status(404).json({ message: "Pet not found." });
            return;
        }

        const pet = pets[0];
        const currentAge = calculateAge(pet.pet_BDAY);

        // Lazy Update: Update DB if age changed
        if (currentAge !== pet.pet_age) {
            await pool.query(
                "UPDATE pets_information SET pet_age = ? WHERE pet_id = ?",
                [currentAge, pet.pet_id]
            );
        }
        
        // Safety check for allergies JSON parsing
        let parsedAllergies = [];
        try {
            if (pet.pet_allergies) {
                // Try to parse if it looks like JSON
                if (pet.pet_allergies.trim().startsWith('[') || pet.pet_allergies.trim().startsWith('{')) {
                    parsedAllergies = JSON.parse(pet.pet_allergies);
                } else {
                    // It's a plain string, wrap it in an object for the frontend
                    parsedAllergies = [{ allergen: pet.pet_allergies, severity: "Unknown", symptoms: "Not specified" }];
                }
            }
        } catch (e) {
            console.error("Failed to parse allergies:", e);
            parsedAllergies = [{ allergen: pet.pet_allergies, severity: "Unknown", symptoms: "Not specified" }];
        }

        res.json({
            id: pet.pet_sharable_ID,
            dbId: pet.pet_id,
            name: pet.pet_name,
            species: pet.pet_species,
            breed: pet.pet_breed,
            birthDate: pet.pet_BDAY,
            status: pet.pet_status,
            age: pet.pet_age,
            gender: pet.pet_gender,
            weight: pet.pet_weight,
            microchipId: pet.pet_microchip,
            ownerName: pet.pet_Temp_owner,
            allergies: parsedAllergies,
            color: pet.pet_color_marking,
            profileImage: pet.pet_profile_image || "",
            vaccinations: [] 
        });
    } catch (error) {
        res.status(500).json({ message: error.message || "Failed to fetch pet." });
    }
});

userAddPetOwner.patch("/api/pet_information/:id/status", async (req, res) => {
    const { id } = req.params; // sharable ID
    const { status } = req.body;

    try {
        await pool.query(
            "UPDATE pets_information SET pet_status = ? WHERE pet_sharable_ID = ?",
            [status, id]
        );
        res.json({ message: "Status updated successfully." });
    } catch (error) {
        res.status(500).json({ message: error.message || "Failed to update status." });
    }
});

// Update user profile
userAddPetOwner.patch("/api/users/:userId", async (req, res) => {
    const { userId } = req.params;
    const { firstName, lastName, phoneNumber, address, dateOfBirth, profileImage } = req.body;

    // console.log(`[PROFILE UPDATE] Received request for User ID: ${userId}`);
    // console.log(`[PROFILE UPDATE] Data:`, { firstName, lastName, phoneNumber, address, dateOfBirth, profileImage });

    try {
        const [result] = await pool.query(
            `UPDATE users 
             SET first_name = ?, last_name = ?, phoneNumber = ?, personal_Address = ?, birthdate = ?, setProfilePic_url = ?
             WHERE user_id = ?`,
            [firstName, lastName, phoneNumber, address, dateOfBirth || null, profileImage || null, userId]
        );

        // console.log(`[PROFILE UPDATE] Database update result:`, result);

        if (result.affectedRows === 0) {
            // console.warn(`[PROFILE UPDATE] No user found with ID: ${userId}`);
            return res.status(404).json({ message: "User not found." });
        }

        res.json({ message: "Profile updated successfully." });
    } catch (error) {
        // console.error("[PROFILE UPDATE] Critical error:", error);
        res.status(500).json({ message: error.message || "Failed to update profile." });
    }
});

userAddPetOwner.listen(PORT, () => {
    console.log(`API server running at http://localhost:${PORT}`);
});
