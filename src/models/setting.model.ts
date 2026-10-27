import mongoose, { model, Schema } from "mongoose";

interface ISettings{
    userId : string
    businessName: string
    businessEmail: string
    knowledge: string
}

const settingSchema = new Schema({
    userId: {
        type: String,
        required: true,
        unique: true
    },
    businessName: {
        type: String,
        required: true,
    },
    businessEmail: {
        type: String,
        required: true,
    },
    knowledge: {
        type: String,
        required: true,
    }
}, { timestamps: true });

const Setting = mongoose.models.Setting || model("Setting", settingSchema)
export default Setting