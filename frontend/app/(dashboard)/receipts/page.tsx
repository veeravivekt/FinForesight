"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileText, Trash2, Link2, CheckCircle2, XCircle, RefreshCw, Sparkles, Loader2 } from "lucide-react";
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
  ocrData?: {
    text?: string;
    confidence?: number;
    method?: string;
    extractedData?: {
      items?: Array<{ description: string; price: number; quantity?: number }>;
      subtotal?: number;
      tax?: number;
      tip?: number;
      payment_method?: string;
    };
  };
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

  const reprocessMutation = useMutation({
    mutationFn: (id: string) => api.post(`/receipts/${id}/process`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      if (viewingReceipt) {
        // Refresh the viewing receipt data
        queryClient.invalidateQueries({ queryKey: ["receipts"] });
      }
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
              <div className="relative aspect-video bg-gray-100 dark:bg-gray-800 flex items-center justify-center cursor-pointer" onClick={() => handleViewReceipt(receipt)}>
                <div className="flex flex-col items-center justify-center text-gray-400 dark:text-gray-600">
                  <FileText className="h-16 w-16 mb-2" />
                  <p className="text-sm">Receipt Image</p>
                </div>
                <div className="absolute top-2 right-2 flex gap-1 flex-wrap">
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
                  {receipt.ocrData?.method === "gemini" && (
                    <Badge variant="outline" className="bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-700">
                      <Sparkles className="h-3 w-3 mr-1" />
                      AI Processed
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
                  <div className="flex gap-2">
                    {!receipt.isProcessed && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => reprocessMutation.mutate(receipt._id)}
                        disabled={reprocessMutation.isPending}
                        className="text-xs"
                      >
                        {reprocessMutation.isPending ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3 mr-1" />
                        )}
                        Re-process with AI
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-600 hover:text-red-700"
                      onClick={() => handleDelete(receipt._id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
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
              <div className="relative w-full bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden flex items-center justify-center p-8 min-h-[200px]">
                <div className="flex flex-col items-center justify-center text-gray-400 dark:text-gray-600">
                  <FileText className="h-24 w-24 mb-4" />
                  <p className="text-sm">Receipt image available</p>
                  <p className="text-xs mt-1 text-gray-500">Image preview not available</p>
                </div>
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

              {/* Enhanced OCR Data */}
              {viewingReceipt.ocrData && (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">OCR Information</p>
                      {viewingReceipt.ocrData.confidence && (
                        <Badge variant="outline">
                          Confidence: {(viewingReceipt.ocrData.confidence * 100).toFixed(0)}%
                        </Badge>
                      )}
                      {viewingReceipt.ocrData.method === "gemini" && (
                        <Badge variant="outline" className="bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-700">
                          <Sparkles className="h-3 w-3 mr-1" />
                          Processed with Gemini AI
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Line Items */}
                  {viewingReceipt.ocrData.extractedData?.items &&
                    viewingReceipt.ocrData.extractedData.items.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Line Items</p>
                        <div className="border rounded-lg divide-y">
                          {viewingReceipt.ocrData.extractedData.items.map((item: any, idx: number) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-3"
                            >
                              <div className="flex-1">
                                <p className="font-medium text-sm">{item.description}</p>
                                {item.quantity && item.quantity > 1 && (
                                  <p className="text-xs text-gray-500">
                                    Qty: {item.quantity}
                                  </p>
                                )}
                              </div>
                              <p className="font-semibold">${item.price.toFixed(2)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Breakdown */}
                  {(viewingReceipt.ocrData.extractedData?.subtotal ||
                    viewingReceipt.ocrData.extractedData?.tax ||
                    viewingReceipt.ocrData.extractedData?.tip) && (
                    <div>
                      <p className="text-sm font-medium mb-2">Breakdown</p>
                      <div className="border rounded-lg p-3 space-y-2">
                        {viewingReceipt.ocrData.extractedData.subtotal && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Subtotal</span>
                            <span className="font-medium">
                              ${viewingReceipt.ocrData.extractedData.subtotal.toFixed(2)}
                            </span>
                          </div>
                        )}
                        {viewingReceipt.ocrData.extractedData.tax && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Tax</span>
                            <span className="font-medium">
                              ${viewingReceipt.ocrData.extractedData.tax.toFixed(2)}
                            </span>
                          </div>
                        )}
                        {viewingReceipt.ocrData.extractedData.tip && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Tip</span>
                            <span className="font-medium">
                              ${viewingReceipt.ocrData.extractedData.tip.toFixed(2)}
                            </span>
                          </div>
                        )}
                        {viewingReceipt.amount && (
                          <div className="flex justify-between text-base font-semibold pt-2 border-t">
                            <span>Total</span>
                            <span>${viewingReceipt.amount.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Payment Method */}
                  {viewingReceipt.ocrData.extractedData?.payment_method && (
                    <div>
                      <p className="text-sm text-gray-500">Payment Method</p>
                      <Badge variant="outline" className="mt-1">
                        {viewingReceipt.ocrData.extractedData.payment_method}
                      </Badge>
                    </div>
                  )}

                  {/* Raw OCR Text (if available and not Gemini) */}
                  {viewingReceipt.ocrData.text &&
                    viewingReceipt.ocrData.method !== "gemini" && (
                      <div>
                        <p className="text-sm text-gray-500 mb-2">Extracted Text</p>
                        <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs overflow-auto max-h-40">
                          {viewingReceipt.ocrData.text}
                        </pre>
                      </div>
                    )}
                </div>
              )}

              {/* Re-process Button in Dialog */}
              {!viewingReceipt.isProcessed && (
                <div className="pt-4 border-t">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      reprocessMutation.mutate(viewingReceipt._id);
                    }}
                    disabled={reprocessMutation.isPending}
                  >
                    {reprocessMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Re-process with AI
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

