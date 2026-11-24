
import mongoose from "mongoose";

const productSchema = new mongoose.Schema({

    // Product Information
    name: {
        type: String,
        required: true,
        trim: true
    },

    category: {
        type: String,
        required: true,
        trim: true
    },

    description: {
        type: String,
        default: "",
        trim: true
    },

    image: {
        type: String,
        default: ""
    },

    // Product Weight
    weight: {
        type: String,
        required: true,
        enum: [
            "50g",
            "100g",
            "250g",
            "500g",
            "1kg"
        ],
        default: "250g"
    },

    // Pricing
    price: {
        type: Number,
        required: true,
        min: 1
    },

    oldPrice: {
        type: Number,
        required: true,
        min: 0,
        validate: {
            validator: function (value) {
                return value >= this.price;
            },
            message: "Original price must be greater than or equal to selling price."
        }
    },

    // Inventory
    stock: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },

    // Product Availability
    active: {
        type: Boolean,
        default: true
    }

}, {
    timestamps: true
});


// Product Indexes
productSchema.index({
    category: 1,
    active: 1
});

productSchema.index({
    name: 1
});


// Export Product Model
const Product = mongoose.model(
    "Product",
    productSchema
);

export default Product;
