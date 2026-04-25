import bcrypt from "bcryptjs";
import { pool } from "./db.js";

export async function loginUser(req, res) {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
        res.status(400).json({ message: "Email and password are required." });
        return;
    }

    try {
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
                user_password
             FROM users
             WHERE mail_Address = ?
             LIMIT 1`,
            [email]
        );

        const user = rows[0];

        if (!user) {
            res.status(401).json({ message: "Invalid email or password." });
            return;
        }

        const passwordMatches = await bcrypt.compare(password, user.user_password);

        if (!passwordMatches) {
            res.status(401).json({ message: "Invalid email or password." });
            return;
        }

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
            },
        });
    } catch (error) {
        res.status(500).json({ message: error.message || "Failed to find user." });
    }
}
