
import bcrypt from 'bcryptjs';
import generationToken from "../tokengeneration/generationToken.js";
import UserDetails from "../models/userDetailsModel.js";
import Order from '../models/Order.js';

export const createUser = async (req, res, next) => {
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
export const getUsers = async (req, res, next) => {
    try {
        const users = await UserDetails.find();
        res.status(200).json(users);
    } catch (error) {
        next(error);
    }
};

export const authenticate = async (req, res, next) => {
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



export const checkCustomerMobile = async (req, res, next) => {
    try {
        const { phone } = req.body;

        if (!phone || !/^[6-9][0-9]{9}$/.test(phone)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid 10-digit mobile number.'
            });
        }

        // Find registered customer
        const user = await UserDetails.findOne({
            phone,
            role: 'CUSTOMER'
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Mobile number not registered. Please visit our store to purchase.'
            });
        }

        if (user.status !== 'ACTIVE') {
            return res.status(403).json({
                success: false,
                message: 'Your account is inactive. Please contact support.'
            });
        }

        // Get customer's latest order
        const latestOrder = await Order.findOne({
            userId: user._id
        }).sort({ createdAt: -1 });

        // Generate JWT
        const token = generationToken(user);

        // Prepare customer details
        const userDetails = {
            _id: user._id,
            name: user.name,
            email: user.email || '',
            phone: user.phone,

            // Get delivery details from latest order
            address: latestOrder?.customer?.address || '',
            city: latestOrder?.customer?.city || '',
            pincode: latestOrder?.customer?.pincode || '',

            role: user.role,
            status: user.status,
            uniqueUserId: user.uniqueUserId
        };

        return res.status(200).json({
            success: true,
            message: 'Customer details retrieved successfully.',
            token,
            data: userDetails
        });

    } catch (error) {
        next(error);
    }
};

export const updateProfile = async (req, res, next) => {
    try {
        const {
            name,
            email,
            phone,
            address,
            city,
            pincode,
            profileImage
        } = req.body;

        // Validate required fields
        if (!name || !phone) {
            return res.status(400).json({
                success: false,
                message: 'Name and mobile number are required.'
            });
        }

        // Validate mobile number
        if (!/^[6-9][0-9]{9}$/.test(phone)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid mobile number.'
            });
        }

        // Check whether another user uses this mobile
        const existingPhone = await UserDetails.findOne({
            phone,
            _id: { $ne: req.user._id }
        });

        if (existingPhone) {
            return res.status(409).json({
                success: false,
                message: 'This mobile number is already registered.'
            });
        }

        // Check whether another user uses this email
        if (email) {
            const existingEmail = await UserDetails.findOne({
                email: email.trim().toLowerCase(),
                _id: { $ne: req.user._id }
            });

            if (existingEmail) {
                return res.status(409).json({
                    success: false,
                    message: 'This email is already registered.'
                });
            }
        }

        // Update only permitted profile fields
        const updatedUser = await UserDetails.findByIdAndUpdate(
            req.user._id,
            {
                $set: {
                    name: name.trim(),
                    email: email?.trim().toLowerCase() || '',
                    phone,
                    address: address?.trim() || '',
                    city: city?.trim() || '',
                    pincode: pincode?.trim() || '',
                    profileImage: profileImage || ''
                }
            },
            {
                new: true,
                runValidators: true
            }
        ).select('-password -otp -resetPasswordToken');

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found.'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Profile updated successfully.',
            data: {
                _id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                phone: updatedUser.phone,
                address: updatedUser.address,
                city: updatedUser.city,
                pincode: updatedUser.pincode,
                profileImage: updatedUser.profileImage,
                role: updatedUser.role,
                status: updatedUser.status,
                uniqueUserId: updatedUser.uniqueUserId
            }
        });

    } catch (error) {
        next(error);
    }
};