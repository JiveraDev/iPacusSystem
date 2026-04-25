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

userAddPetOwner.get("/api/health", async (_req, res) => {
    try {
        await pool.query("SELECT 1");
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ ok: false, message: error.message });
    }
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

userAddPetOwner.listen(PORT, () => {
    console.log(`API server running at http://localhost:${PORT}`);
});
