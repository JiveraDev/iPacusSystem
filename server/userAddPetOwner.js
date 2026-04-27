import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { pool } from "./db.js";
import { loginUser } from "./userFind.js";

dotenv.config();

const userAddPetOwner = express();
const PORT = Number(process.env.PORT);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN;

userAddPetOwner.use(cors({ origin: FRONTEND_ORIGIN || true }));
userAddPetOwner.use(express.json());

// Request logger
userAddPetOwner.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

userAddPetOwner.get("/api/health", async (_req, res) => {
    try {
        await pool.query("SELECT 1");
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ ok: false, message: error.message });
    }
});

userAddPetOwner.get("/api/test", (req, res) => {
    res.json({ message: "Server is working!" });
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

userAddPetOwner.get("/api/pet_information", async (req, res) => {
    try {
        const [pets] = await pool.query(
            "SELECT * FROM pets_information ORDER BY pet_id DESC"
        );
        res.json(pets.map(pet => ({
            id: pet.pet_sharable_ID,
            dbId: pet.pet_id,
            petName: pet.pet_name,
            species: pet.pet_species,
            breed: pet.pet_breed,
            birthDate: pet.pet_BDAY,
            status: pet.pet_status,
            age: pet.pet_age,
            gender: pet.pet_gender,
            weight: pet.pet_weight,
            microchipNumber: pet.pet_microchip,
            tempOwnerName: pet.pet_Temp_owner,
            allergies: pet.pet_allergies,
            colorMarkings: pet.pet_color_marking
        })));
    } catch (error) {
        res.status(500).json({ message: error.message || "Failed to fetch pets." });
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
            (pet_name, pet_species, pet_breed, pet_BDAY, pet_status, pet_age, pet_gender, pet_weight, pet_microchip, pet_Temp_owner, pet_allergies, pet_color_marking)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
                colorMarkings || null
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

userAddPetOwner.listen(PORT, () => {
    console.log(`API server running at http://localhost:${PORT}`);
});
