
import bcrypt from 'bcryptjs';
import generationToken from "../tokengeneration/generationToken.js";
import UserDetails from "../models/userDetailsModel.js";

export const createUser = async  (req, res, next) => {
    try {
        const {
            name,
            email,
            phone,
            role,
            password
        } = req.body;
        const defaultPassword = password || "12345";
        const hashedPassword = await bcrypt.hash(
            defaultPassword,
            10
        );
        // Check existing email
        const existingUser = await UserDetails.findOne({
            email
        });
        if (existingUser) {
            return res.status(409).json({
                message: 'User Already Exists'
            });
        }
        // Allow only CUSTOMER / STAFF
        const userRole =
            role === 'ADMIN'
                ? 'ADMIN'
                : role === 'STAFF'
                    ? 'STAFF'
                    : 'CUSTOMER';
        // =====================================
        // Generate Unique User ID
        // =====================================
        const lastUser = await UserDetails
            .findOne({
                uniqueUserId: {
                    $regex: /^NNDF\d+$/
                }
            })
            .sort({
                uniqueUserId: -1
            });
        let uniqueUserId = "NNDF000001";
        if (lastUser?.uniqueUserId) {
            const lastNumber = parseInt(
                lastUser.uniqueUserId.replace("NNDF", ""),
                10
            );
            uniqueUserId =
                `NNDF${String(lastNumber + 1).padStart(6, "0")}`;
        }
       
        // =====================================
        // Create User
        // =====================================
        const newUser = new UserDetails({
            name,
            email,
            phone,
            password: hashedPassword,
            role: userRole,
            uniqueUserId
        });
        await newUser.save();
        // Signup Email
        // await sendSignupCreatedEmail(newUser);
        // =====================================
        // Response
        // =====================================
        return res.status(201).json({
            message: 'Signup successfully',
            data: {
                id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                phone: newUser.phone,
                role: newUser.role,
                uniqueUserId: newUser.uniqueUserId
            }
        });
    } catch (error) {
        next(error);
    }
};
export const getUsers = async  (req, res, next) => {
    try {
        const users = await UserDetails.find();
        res.status(200).json(users);
    } catch (error) {
        next(error);
    }
};

export const authenticate = async  (req, res, next) => {
    try {
        const { email, password } = req.body;
        // 1. Find user by email
        const user = await UserDetails.findOne({ email });
        // 2. Email not found
        if (!user) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }
        // 3. Compare password
        const isMatch = await bcrypt.compare(
            password,
            user.password
        );
        // 4. Password doesn't match
        if (!isMatch) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }
        // 5. Check user status
        if (user.status !== "ACTIVE") {
            return res.status(403).json({
                message: "User account is inactive"
            });
        }
        // 6. Generate JWT
        const token = generationToken(user);
        // 7. User details
        const userDetails = {
            _id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user?.role,
            status: user.status,
            uniqueUserId: user.uniqueUserId,
        };
        // 8. Login successful
        return res.status(200).json({
            message: "Login successful",
            token: token,
            data: userDetails
        });
    } catch (error) {
        next(error);
    }
};
