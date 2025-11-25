"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, X, CheckCircle2, FileText } from "lucide-react";
import { api } from "@/lib/api";

interface ReceiptUploadProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ReceiptUpload({ onSuccess, onCancel }: ReceiptUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];
    if (!allowedTypes.includes(selectedFile.type)) {
      setError("Please select a JPEG, PNG, or PDF file");
      return;
    }

    // Validate file size (10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("File size must be less than 10MB");
      return;
    }

    setFile(selectedFile);
    setError(null);

    // Create preview for images
    if (selectedFile.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    } else {
      setPreview(null);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setPreview(null);
    setExtractedData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      
      // Use the same API base URL pattern as the rest of the app
      const API_VERSION = process.env.NEXT_PUBLIC_API_VERSION || "v1";
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || `http://localhost:3000/api/${API_VERSION}`;
      const response = await fetch(`${API_BASE_URL}/receipts/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(errorData.error || "Upload failed");
      }

      const data = await response.json();
      setExtractedData({
        ...data.extractedData,
        autoCreatedTransaction: data.autoCreatedTransaction,
        confidence: data.confidence,
      });
      setSuccess(true);

      // Auto-close after 3 seconds if data was extracted
      if (data.extractedData && (data.extractedData.merchant || data.extractedData.amount)) {
        setTimeout(() => {
          onSuccess();
        }, 3000);
      }
    } catch (err: any) {
      setError(err.message || "Failed to upload receipt");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            <div className="space-y-2">
              <p className="font-semibold">
                {extractedData?.autoCreatedTransaction
                  ? "Receipt processed and transaction created automatically!"
                  : extractedData?.confidence && extractedData.confidence > 0.9
                  ? "Receipt processed successfully!"
                  : "Receipt uploaded successfully!"}
              </p>
              {extractedData && (extractedData.merchant || extractedData.amount) && (
                <div className="mt-2 text-sm space-y-1">
                  {extractedData.merchant && <p>Merchant: {extractedData.merchant}</p>}
                  {extractedData.amount && <p>Amount: ${extractedData.amount.toFixed(2)}</p>}
                  {extractedData.category && <p>Category: {extractedData.category}</p>}
                  {extractedData.confidence && (
                    <p className="text-xs opacity-75">
                      Confidence: {(extractedData.confidence * 100).toFixed(0)}%
                    </p>
                  )}
                  {extractedData.autoCreatedTransaction && (
                    <div className="mt-2 p-2 bg-green-100 dark:bg-green-900/30 rounded text-xs">
                      <p className="font-semibold">Transaction Created:</p>
                      <p>{extractedData.autoCreatedTransaction.description}</p>
                      <p>${Math.abs(extractedData.autoCreatedTransaction.amount).toFixed(2)}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {!success ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="receipt-file">Select Receipt</Label>
            <div className="flex items-center gap-4">
              <Input
                id="receipt-file"
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,application/pdf"
                onChange={handleFileSelect}
                disabled={uploading}
                className="cursor-pointer"
              />
            </div>
            <p className="text-xs text-gray-500">
              Supports JPEG, PNG, and PDF files (max 10MB)
            </p>
          </div>

          {preview && (
            <div className="relative">
              <div className="relative w-full bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full h-auto max-h-64 object-contain"
                />
              </div>
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2"
                onClick={handleRemoveFile}
                disabled={uploading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {file && !preview && (
            <div className="flex items-center gap-2 p-4 border rounded-lg">
              <FileText className="h-8 w-8 text-gray-400" />
              <div className="flex-1">
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-gray-500">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRemoveFile}
                disabled={uploading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={onCancel} disabled={uploading}>
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!file || uploading}
            >
              {uploading ? (
                <>
                  <Upload className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Receipt
                </>
              )}
            </Button>
          </div>
        </>
      ) : (
        <div className="flex gap-2 justify-end pt-4">
          <Button onClick={onSuccess}>
            Done
          </Button>
        </div>
      )}
    </div>
  );
}

