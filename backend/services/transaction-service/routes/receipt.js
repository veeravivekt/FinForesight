import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import Receipt from "../../../shared/models/Receipt.js";
import Transaction from "../../../shared/models/Transaction.js";
import { createRateLimiter } from "../../../shared/middleware/rateLimiter.js";
import axios from "axios";
import { sendError, sendNotFoundError, sendValidationError, sendInternalError } from "../../../shared/utils/errorHandler.js";
import { createServiceLogger } from "../../../shared/utils/logger.js";

const router = express.Router();
const logger = createServiceLogger("transaction-service");
const receiptLimiter = createRateLimiter(50, 60);

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), "uploads", "receipts");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `receipt-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Only JPEG, PNG, and PDF files are allowed"));
  },
});

// Get all receipts
router.get("/", receiptLimiter, async (req, res) => {
  try {
    const { transactionId, isProcessed } = req.query;
    const query = { userId: req.userId };
    
    if (transactionId) query.transactionId = transactionId;
    if (isProcessed !== undefined) query.isProcessed = isProcessed === "true";

    const receipts = await Receipt.find(query)
      .populate("transactionId", "description amount category date")
      .sort({ createdAt: -1 });

    res.json({ receipts });
  } catch (error) {
    logger.error("Get receipts error:", error);
    sendInternalError(res);
  }
});

// Get receipt by ID
router.get("/:id", receiptLimiter, async (req, res) => {
  try {
    const receipt = await Receipt.findOne({
      _id: req.params.id,
      userId: req.userId,
    }).populate("transactionId");

    if (!receipt) {
      return sendNotFoundError(res, "Receipt");
    }

    res.json(receipt);
  } catch (error) {
    logger.error("Get receipt error:", error);
    sendInternalError(res);
  }
});

// Upload and process receipt
router.post("/upload", receiptLimiter, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return sendValidationError(res, "No file uploaded");
    }

    const filePath = req.file.path;
    const imageUrl = `/uploads/receipts/${req.file.filename}`;

    // Call OCR service (if available)
    let ocrData = null;
    let extractedData = {
      merchant: null,
      amount: null,
      date: null,
      category: null,
    };

    try {
      const ML_SERVICE = process.env.ML_SERVICE_URL || "http://localhost:3003";
      const PYTHON_ML_SERVICE = process.env.PYTHON_ML_SERVICE_URL || "http://localhost:5000";
      
      // Try to call OCR endpoint
      const ocrResponse = await axios.post(`${PYTHON_ML_SERVICE}/ocr/extract`, {
        image_path: filePath,
      }, {
        timeout: 30000,
      });

      ocrData = ocrResponse.data.ocr_data;
      extractedData = {
        merchant: ocrResponse.data.merchant || null,
        amount: ocrResponse.data.amount || null,
        date: ocrResponse.data.date || null,
        category: ocrResponse.data.category || null,
      };
    } catch (error) {
      logger.warn("OCR service not available, creating receipt without OCR data");
    }

    const receipt = new Receipt({
      userId: req.userId,
      imageUrl,
      imageKey: req.file.filename,
      merchant: extractedData.merchant,
      amount: extractedData.amount,
      date: extractedData.date ? new Date(extractedData.date) : null,
      category: extractedData.category,
      ocrData,
      isProcessed: !!ocrData,
    });

    await receipt.save();

    res.status(201).json({
      receipt,
      extractedData,
      message: ocrData ? "Receipt processed successfully" : "Receipt uploaded successfully (OCR processing pending)",
    });
  } catch (error) {
    logger.error("Upload receipt error:", error);
    sendInternalError(res);
  }
});

// Link receipt to transaction
router.put("/:id/link", receiptLimiter, async (req, res) => {
  try {
    const { transactionId } = req.body;

    if (!transactionId) {
      return sendValidationError(res, "Transaction ID is required");
    }

    // Verify transaction belongs to user
    const transaction = await Transaction.findOne({
      _id: transactionId,
      userId: req.userId,
    });

    if (!transaction) {
      return sendNotFoundError(res, "Transaction");
    }

    const receipt = await Receipt.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { transactionId, isProcessed: true },
      { new: true }
    );

    if (!receipt) {
      return sendNotFoundError(res, "Receipt");
    }

    // Update transaction with receipt link
    transaction.receiptId = receipt._id;
    await transaction.save();

    res.json(receipt);
  } catch (error) {
    logger.error("Link receipt error:", error);
    sendInternalError(res);
  }
});

// Auto-categorize transaction
router.post("/categorize", receiptLimiter, async (req, res) => {
  try {
    const { description, amount, merchant } = req.body;

    if (!description) {
      return sendValidationError(res, "Description is required");
    }

    // Get user's transaction history for pattern matching
    const userTransactions = await Transaction.find({
      userId: req.userId,
    }).sort({ date: -1 }).limit(100);

    // Simple pattern-based categorization
    const categoryPatterns = {
      Food: ["restaurant", "cafe", "food", "grocery", "supermarket", "mcdonald", "starbucks", "pizza"],
      Transport: ["uber", "lyft", "taxi", "gas", "fuel", "parking", "metro", "bus"],
      Shopping: ["amazon", "target", "walmart", "store", "shop", "retail"],
      Bills: ["electric", "water", "internet", "phone", "utility", "bill"],
      Entertainment: ["movie", "cinema", "netflix", "spotify", "theater", "concert"],
      Healthcare: ["pharmacy", "drug", "hospital", "doctor", "medical", "clinic"],
      Education: ["school", "university", "course", "tuition", "bookstore"],
      Travel: ["hotel", "flight", "airline", "airbnb", "travel"],
    };

    let suggestedCategory = "Other";
    let confidence = 0;

    const lowerDescription = description.toLowerCase();
    const lowerMerchant = merchant ? merchant.toLowerCase() : "";

    for (const [category, patterns] of Object.entries(categoryPatterns)) {
      for (const pattern of patterns) {
        if (lowerDescription.includes(pattern) || lowerMerchant.includes(pattern)) {
          suggestedCategory = category;
          confidence = 0.8;
          break;
        }
      }
      if (confidence > 0) break;
    }

    // If no pattern match, check user's history
    if (confidence === 0 && userTransactions.length > 0) {
      const similarTransactions = userTransactions.filter(
        (t) => t.description.toLowerCase().includes(lowerDescription.split(" ")[0])
      );

      if (similarTransactions.length > 0) {
        const categoryCounts = {};
        similarTransactions.forEach((t) => {
          categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
        });

        const mostCommonCategory = Object.keys(categoryCounts).reduce((a, b) =>
          categoryCounts[a] > categoryCounts[b] ? a : b
        );

        suggestedCategory = mostCommonCategory;
        confidence = Math.min(categoryCounts[mostCommonCategory] / similarTransactions.length, 0.9);
      }
    }

    res.json({
      category: suggestedCategory,
      confidence: Math.round(confidence * 100) / 100,
      method: confidence > 0.7 ? "pattern_match" : "history_based",
    });
  } catch (error) {
    logger.error("Categorize error:", error);
    sendInternalError(res);
  }
});

// Delete receipt
router.delete("/:id", receiptLimiter, async (req, res) => {
  try {
    const receipt = await Receipt.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!receipt) {
      return sendNotFoundError(res, "Receipt");
    }

    // Delete file from filesystem
    if (receipt.imageKey) {
      const filePath = path.join(uploadDir, receipt.imageKey);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Remove receipt link from transaction if exists
    if (receipt.transactionId) {
      await Transaction.findByIdAndUpdate(receipt.transactionId, {
        $unset: { receiptId: 1 },
      });
    }

    await Receipt.deleteOne({ _id: req.params.id });

    res.json({ message: "Receipt deleted successfully" });
  } catch (error) {
    logger.error("Delete receipt error:", error);
    sendInternalError(res);
  }
});

export default router;

