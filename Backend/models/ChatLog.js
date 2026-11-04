import mongoose from "mongoose";

const messageSchema = new mongoose.Schema ({
    role: {
        type: String,
        enum: ["customer", "assistant", "admin"], required: true},
        text: { type: String, required: true, trim: true, maxlength: 1500 },
        createdAt: { type: Date, default: Date.now }
    }, {
        id: false
    });

const chatLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    userEmail: { type: String, required: true, trim: true, lowercase: true },
    conversationId: { type: String, required: true },
    messages: { type: [messageSchema], default: [] },
    status: { type: String, enum: ["active", "archived"], default: "active" },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, {
    timestamps: true
});

chatLogSchema.index({ userId: 1, conversationId: 1 }, { unique: true });
chatLogSchema.index({ userEmail: 1, conversationId: 1 }, { unique: true });
chatLogSchema.index({ updatedAt: -1 });

const ChatLog = mongoose.model("ChatLog", chatLogSchema);

export default ChatLog;