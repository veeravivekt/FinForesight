"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileText, Image, Trash2, Link2, CheckCircle2, XCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import ReceiptUpload from "@/components/receipt-upload";
import { format } from "date-fns";

interface Receipt {
  _id: string;
  transactionId?: {
    _id: string;
    description: string;
    amount: number;
    category: string;
    date: string;
  };
  imageUrl: string;
  merchant?: string;
  amount?: number;
  date?: string;
  category?: string;
  isProcessed: boolean;
  ocrData?: any;
  createdAt: string;
}

export default function ReceiptsPage() {
  const [filterProcessed, setFilterProcessed] = useState<string>("all");
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState<Receipt | null>(null);
  const queryClient = useQueryClient();

  // Build query params
  const queryParams = new URLSearchParams();
  if (filterProcessed !== "all") {
    queryParams.append("isProcessed", filterProcessed === "processed" ? "true" : "false");
  }

  const { data, isLoading, error } = useQuery<{ receipts: Receipt[] }>({
    queryKey: ["receipts", filterProcessed],
    queryFn: () => api.get(`/receipts?${queryParams.toString()}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/receipts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
    },
  });

  const receipts = data?.receipts || [];

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this receipt?")) {
      try {
        await deleteMutation.mutateAsync(id);
      } catch (error) {
        console.error("Failed to delete receipt:", error);
      }
    }
  };

  const handleViewReceipt = (receipt: Receipt) => {
    setViewingReceipt(receipt);
  };

  const getReceiptImageUrl = (imageUrl: string) => {
    if (imageUrl.startsWith("http")) return imageUrl;
    // Assuming the backend serves files at /uploads/receipts/
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
    return `${baseUrl}${imageUrl}`;
  };

  const processedCount = receipts.filter((r) => r.isProcessed).length;
  const unprocessedCount = receipts.filter((r) => !r.isProcessed).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Receipts</h1>
          <p className="text-gray-600 dark:text-gray-400">Upload and manage your receipts</p>
        </div>
        <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="mr-2 h-4 w-4" />
              Upload Receipt
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Upload Receipt</DialogTitle>
            </DialogHeader>
            <ReceiptUpload
              onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ["receipts"] });
                setIsUploadDialogOpen(false);
              }}
              onCancel={() => setIsUploadDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      {receipts.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Receipts</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{receipts.length}</div>
              <p className="text-xs text-muted-foreground">All receipts</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Processed</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{processedCount}</div>
              <p className="text-xs text-muted-foreground">OCR processed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <XCircle className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{unprocessedCount}</div>
              <p className="text-xs text-muted-foreground">Awaiting processing</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full max-w-xs">
            <Select value={filterProcessed} onValueChange={setFilterProcessed}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Receipts</SelectItem>
                <SelectItem value="processed">Processed</SelectItem>
                <SelectItem value="unprocessed">Unprocessed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>Failed to load receipts. Please try again.</AlertDescription>
        </Alert>
      )}

      {/* Receipts List */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-48 w-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : receipts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Upload className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No receipts yet</h3>
            <p className="text-gray-500 mb-4">
              Upload your first receipt to start tracking expenses automatically.
            </p>
            <Button onClick={() => setIsUploadDialogOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Upload Receipt
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {receipts.map((receipt) => (
            <Card key={receipt._id} className="overflow-hidden">
              <div className="relative aspect-video bg-gray-100 dark:bg-gray-800">
                <img
                  src={getReceiptImageUrl(receipt.imageUrl)}
                  alt="Receipt"
                  className="w-full h-full object-contain cursor-pointer"
                  onClick={() => handleViewReceipt(receipt)}
                />
                <div className="absolute top-2 right-2 flex gap-1">
                  {receipt.isProcessed ? (
                    <Badge variant="default" className="bg-green-600">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Processed
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <XCircle className="h-3 w-3 mr-1" />
                      Pending
                    </Badge>
                  )}
                </div>
              </div>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">
                      {receipt.merchant || "Receipt"}
                    </CardTitle>
                    {receipt.amount && (
                      <p className="text-lg font-bold mt-1">${receipt.amount.toFixed(2)}</p>
                    )}
                    {receipt.category && (
                      <Badge variant="outline" className="mt-1">
                        {receipt.category}
                      </Badge>
                    )}
                    {receipt.date && (
                      <p className="text-sm text-gray-500 mt-1">
                        {format(new Date(receipt.date), "MMM dd, yyyy")}
                      </p>
                    )}
                    {receipt.transactionId && (
                      <div className="flex items-center gap-1 mt-2 text-sm text-green-600">
                        <Link2 className="h-3 w-3" />
                        Linked to transaction
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-600 hover:text-red-700"
                    onClick={() => handleDelete(receipt._id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {/* Receipt View Dialog */}
      {viewingReceipt && (
        <Dialog open={!!viewingReceipt} onOpenChange={() => setViewingReceipt(null)}>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Receipt Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="relative w-full bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                <img
                  src={getReceiptImageUrl(viewingReceipt.imageUrl)}
                  alt="Receipt"
                  className="w-full h-auto"
                />
              </div>
              
              <div className="grid gap-4 md:grid-cols-2">
                {viewingReceipt.merchant && (
                  <div>
                    <p className="text-sm text-gray-500">Merchant</p>
                    <p className="font-medium">{viewingReceipt.merchant}</p>
                  </div>
                )}
                {viewingReceipt.amount && (
                  <div>
                    <p className="text-sm text-gray-500">Amount</p>
                    <p className="font-medium">${viewingReceipt.amount.toFixed(2)}</p>
                  </div>
                )}
                {viewingReceipt.category && (
                  <div>
                    <p className="text-sm text-gray-500">Category</p>
                    <Badge variant="outline">{viewingReceipt.category}</Badge>
                  </div>
                )}
                {viewingReceipt.date && (
                  <div>
                    <p className="text-sm text-gray-500">Date</p>
                    <p className="font-medium">
                      {format(new Date(viewingReceipt.date), "MMM dd, yyyy")}
                    </p>
                  </div>
                )}
                {viewingReceipt.transactionId && (
                  <div className="md:col-span-2">
                    <p className="text-sm text-gray-500">Linked Transaction</p>
                    <p className="font-medium">
                      {viewingReceipt.transactionId.description} - $
                      {viewingReceipt.transactionId.amount.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>

              {viewingReceipt.ocrData && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">OCR Data</p>
                  <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs overflow-auto">
                    {JSON.stringify(viewingReceipt.ocrData, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

