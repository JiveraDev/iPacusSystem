import { useNavigate } from "../dashboardRouter.jsx";
import { toast } from "../../reusecomponent/toast.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { Input } from "../../ui/input";
import { Textarea } from "../../ui/textarea";
import { ArrowLeft, Upload, CheckCircle, AlertCircle, Loader2, X } from "lucide-react";
import { useState, useEffect } from "react";
import { DECEASED_PET_BOOKING_MESSAGE, isDeceasedPetStatus } from "../../lib/petStatus";

export default function PaymentSubmission() {
  const navigate = useNavigate();
  const [paymentData, setPaymentData] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    paymentMethod: "",
    referenceNumber: "",
    amount: "",
    notes: "",
    receiptFile: null,
    additionalImages: [],
  });

  useEffect(() => {
    const details = sessionStorage.getItem("paymentDetails");
    if (details) {
      const parsed = JSON.parse(details);
      setPaymentData(parsed);
      setFormData(prev => ({ ...prev, amount: parsed.amount || "" }));
    }
  }, []);

  const dataURLtoFile = (dataurl, filename) => {
    let arr = dataurl.split(','),
        mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), 
        n = bstr.length, 
        u8arr = new Uint8Array(n);
        
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    
    return new File([u8arr], filename, {type:mime});
  };

  const uploadFile = async (file, type = "booking_payment") => {
    const data = new FormData();
    data.append("image", file);
    data.append("type", type);

    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/upload`, {
      method: "POST",
      body: data,
    });

    if (!response.ok) throw new Error("Failed to upload image");
    const result = await response.json();
    return result.url;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isDeceasedPetStatus(paymentData?.bookingData?.petStatus)) {
      toast.error(DECEASED_PET_BOOKING_MESSAGE);
      return;
    }
    if (!formData.paymentMethod) {
      toast.error("Please select a payment method");
      return;
    }
    if (!formData.receiptFile && formData.paymentMethod !== "cash") {
      toast.error("Please upload proof of payment");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Upload Receipt
      const receiptUrl = formData.receiptFile ? await uploadFile(formData.receiptFile) : null;

      // 2. Handle Signature if it exists (base64)
      let signatureUrl = paymentData.bookingData.signature;
      if (signatureUrl && signatureUrl.startsWith('data:image')) {
        try {
          const signatureFile = dataURLtoFile(signatureUrl, `signature_${Date.now()}.png`);
          signatureUrl = await uploadFile(signatureFile, "booking_signature");
        } catch (sigError) {
          console.error("Signature upload failed:", sigError);
        }
      }

      // 3. Handle additional images if they exist (base64 array)
      let uploadedImageUrls = [];
      if (paymentData.bookingData.images && Array.isArray(paymentData.bookingData.images)) {
        for (let i = 0; i < paymentData.bookingData.images.length; i++) {
          const img = paymentData.bookingData.images[i];
          if (img.startsWith('data:image')) {
            try {
              const imgFile = dataURLtoFile(img, `concern_${Date.now()}_${i}.png`);
              const url = await uploadFile(imgFile, "booking_concern");
              uploadedImageUrls.push(url);
            } catch (imgError) {
              console.error("Concern image upload failed:", imgError);
            }
          } else {
            uploadedImageUrls.push(img);
          }
        }
      }

      // 4. Prepare Booking Data (Generic structure)
      const bookingData = {
        ...paymentData.bookingData,
        payment_proof_url: receiptUrl,
        payment_method: formData.paymentMethod,
        payment_reference: formData.referenceNumber,
        price: formData.amount,
        signature: signatureUrl, // Map to signature_path in PHP
        Image_Booking_Concern_Path: uploadedImageUrls.length > 0 ? uploadedImageUrls[0] : null, // PHP expects single path
        // You might want to store all images in a JSON field if the DB supports it, 
        // but for now let's use the first one as per add_booking.php
      };

      // 5. Submit Booking to DB
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingData),
      });

      if (response.ok) {
        toast.success("Booking and payment submitted successfully!");
        sessionStorage.removeItem("paymentDetails");
        sessionStorage.removeItem("pendingHomeBooking");
        // Redirect based on the booking type
        navigate("/dashboard/services"); 
      } else {
        const error = await response.json();
        throw new Error(error.message || "Failed to create booking");
      }
    } catch (error) {
      console.error("Submission error:", error);
      toast.error(error.message || "An error occurred during submission");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReceiptChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFormData({ ...formData, receiptFile: e.target.files[0] });
    }
  };

  const paymentMethods = [
    {
      value: "maya",
      label: "Maya",
      instructions: "Send payment to Maya account: 0917-XXX-XXXX (iPawcus Veterinary). Upload screenshot of successful transaction.",
    },
    {
      value: "gcash",
      label: "GCash",
      instructions: "Send payment to GCash account: 0917-XXX-XXXX (iPawcus Veterinary). Upload screenshot of successful transaction.",
    },
    {
      value: "cash",
      label: "Cash Payment",
      instructions: "Our personnel will verify your booking and call you for identification before the admin confirms it.",
    },
    {
      value: "other",
      label: "Other Payment Method",
      instructions: "Please specify your payment method in the notes section and upload proof of payment.",
    },
  ];

  const selectedMethod = paymentMethods.find((m) => m.value === formData.paymentMethod);

  return (
    <div className="space-y-6 lg:space-y-8 max-w-4xl mx-auto pb-10">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <Button variant="ghost" onClick={() => navigate(-1)} disabled={isSubmitting}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Complete Payment</h1>
          <p className="text-gray-600 mt-1">Submit your payment details to finalize your {paymentData?.type || "Booking"}</p>
        </div>
      </div>

      {/* Information Banner */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-gray-700">
              <p className="font-semibold mb-2">Important Instructions:</p>
              <ul className="space-y-1 ml-4">
                <li>• Select your preferred payment method below</li>
                <li>• Upload clear photo/screenshot of your payment receipt</li>
                <li>• Include reference number if applicable</li>
                <li>• Our team will verify your payment within 24 hours</li>
                <li>• You will receive a confirmation once verified</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Form */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Details</CardTitle>
          <CardDescription>Fill in your payment information below</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Payment Method Selection */}
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Payment Method *</Label>
              <select
                id="paymentMethod"
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.paymentMethod}
                onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                disabled={isSubmitting}
              >
                <option value="">Select payment method</option>
                {paymentMethods.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Method Instructions */}
            {selectedMethod && (
              <Card className="bg-green-50 border-green-200">
                <CardContent className="pt-6">
                  <div className="flex gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-gray-900 mb-1">{selectedMethod.label} Instructions:</p>
                      <p className="text-sm text-gray-700">{selectedMethod.instructions}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">Amount to Pay *</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-500 font-semibold">PHP</span>
                <Input
                  id="amount"
                  type="number"
                  required
                  readOnly={!!paymentData?.amount}
                  className="pl-14 bg-gray-50 font-bold text-lg text-blue-600"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
              {paymentData?.amount && (
                  <p className="text-[10px] text-amber-600 font-medium italic">* This is the fixed transport fee for Home Service.</p>
              )}
            </div>

            {/* Reference Number */}
            <div className="space-y-2">
              <Label htmlFor="referenceNumber">Reference/Transaction Number</Label>
              <Input
                id="referenceNumber"
                placeholder="Enter reference number (if applicable)"
                value={formData.referenceNumber}
                onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
                disabled={isSubmitting}
              />
              <p className="text-xs text-gray-500">
                For digital payments (Maya, GCash), please include the transaction reference number
              </p>
            </div>

            {/* Receipt Upload */}
            <div className="space-y-2">
              <Label htmlFor="receipt">Upload Payment Proof/Receipt *</Label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center bg-white hover:border-blue-400 transition-colors min-h-[200px] flex flex-col items-center justify-center relative overflow-hidden">
                {formData.receiptFile ? (
                  <div className="relative w-full flex flex-col items-center animate-in zoom-in duration-300">
                    <div className="relative group">
                      <img 
                        src={URL.createObjectURL(formData.receiptFile)} 
                        alt="Receipt Preview" 
                        className="max-h-[250px] w-auto max-w-full object-contain rounded-lg shadow-md border border-gray-100"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData({...formData, receiptFile: null})}
                        className="absolute -top-3 -right-3 bg-red-500 text-white p-2 rounded-full shadow-xl hover:bg-red-600 transition-all transform hover:scale-110 z-10"
                        title="Remove receipt"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-3 flex items-center gap-2 px-3 py-1 bg-gray-50 rounded-full border border-gray-200">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      <span className="max-w-[min(200px,calc(100vw-7rem))] truncate text-xs font-medium text-gray-600">
                        {formData.receiptFile.name}
                      </span>
                    </div>
                  </div>
                ) : (
                  <label className="cursor-pointer w-full h-full py-8 flex flex-col items-center justify-center">
                    <Upload className="h-10 w-10 text-gray-400 mb-3" />
                    <span className="text-sm font-semibold text-blue-600">Click to upload receipt</span>
                    <span className="text-xs text-gray-400 mt-1">PNG, JPG or PDF up to 10MB</span>
                    <Input
                      id="receipt"
                      type="file"
                      required={formData.paymentMethod !== "cash"}
                      accept="image/*,.pdf"
                      onChange={handleReceiptChange}
                      disabled={isSubmitting}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any additional information about your payment"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                disabled={isSubmitting}
              />
            </div>

            {/* Submit Button */}
            <Button type="submit" className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700" disabled={isSubmitting}>
              {isSubmitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Finalizing Booking...</>
              ) : (
                  "Confirm and Submit Booking"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}


