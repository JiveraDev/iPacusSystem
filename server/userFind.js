import bcrypt from "bcryptjs";
import { pool } from "./db.js";

export async function loginUser(req, res) {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
        res.status(400).json({ message: "Email and password are required." });
        return;
    }

    try {
        // console.log(`[LOGIN] Attempting login for email: ${email}`);
        const [rows] = await pool.query(
            `SELECT
                user_id,
                mail_Address,
                role,
                first_name,
                last_name,
                personal_Address,
                phoneNumber,
                emergencyNumber,
                birthdate,
                setProfilePic_url,
                user_password
             FROM users
             WHERE mail_Address = ?
             LIMIT 1`,
            [email]
        );

        const user = rows[0];

        if (!user) {
            // console.warn(`[LOGIN] No user found with email: ${email}`);
            res.status(401).json({ message: "Invalid email or password." });
            return;
        }

        // console.log(`[LOGIN] User found, comparing password...`);
        const passwordMatches = await bcrypt.compare(password, user.user_password);

        if (!passwordMatches) {
            // console.warn(`[LOGIN] Password mismatch for email: ${email}`);
            res.status(401).json({ message: "Invalid email or password." });
            return;
        }

        // console.log(`[LOGIN] Login successful for: ${email}`);
        res.json({
            message: "Login successful.",
            user: {
                id: user.user_id,
                email: user.mail_Address,
                role: user.role,
                firstName: user.first_name,
                lastName: user.last_name,
                address: user.personal_Address,
                phoneNumber: user.phoneNumber,
                emergencyNumber: user.emergencyNumber,
                dateOfBirth: user.birthdate,
                profileImage: user.setProfilePic_url,
            },
        });
    } catch (error) {
        res.status(500).json({ message: error.message || "Failed to find user." });
    }
}
