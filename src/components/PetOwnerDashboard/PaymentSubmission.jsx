import { useNavigate } from "../dashboardRouter.jsx";
import { toast } from "../../reusecomponent/toast.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { Input } from "../../ui/input";
import { Textarea } from "../../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { ArrowLeft, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { DECEASED_PET_BOOKING_MESSAGE, isDeceasedPetStatus } from "../../lib/petStatus";
import { createBooking } from "../../services/bookingService";
import { uploadImageFile } from "../../services/uploadService";
import SubmissionStatus from "../shared/SubmissionStatus";
import { resolveImageUrl } from "../../lib/image";
import { paymentMethodInstruction, paymentMethodRequiresProof, usePaymentMethods } from "../../hooks/usePaymentMethods";
import { PhotoViewer } from "../../ui/photo-viewer";
import FileUploadDropzone from "../shared/FileUploadDropzone";

export default function PaymentSubmission() {
  const navigate = useNavigate();
  const [paymentData, setPaymentData] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewer, setViewer] = useState(null);
  const [formData, setFormData] = useState({
    paymentMethod: "",
    referenceNumber: "",
    amount: "",
    notes: "",
    receiptFile: null,
    additionalImages: [],
  });
  const { paymentMethods, isLoadingPaymentMethods } = usePaymentMethods();
  const selectedMethod = paymentMethods.find((m) => m.value === formData.paymentMethod);
  const selectedMethodRequiresProof = paymentMethodRequiresProof(selectedMethod);
  const selectedQrUrl = resolveImageUrl(selectedMethod?.qrImageUrl || "");

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) {
      return;
    }

    if (isDeceasedPetStatus(paymentData?.bookingData?.petStatus)) {
      toast.error(DECEASED_PET_BOOKING_MESSAGE);
      return;
    }
    if (!formData.paymentMethod) {
      toast.error("Please select a payment method");
      return;
    }
    if (!formData.receiptFile && selectedMethodRequiresProof) {
      toast.error("Please upload proof of payment");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Upload Receipt
      const receiptUrl = formData.receiptFile ? await uploadImageFile(formData.receiptFile, "booking_payment") : null;

      // 2. Handle Signature if it exists (base64)
      let signatureUrl = paymentData.bookingData.signature;
      if (signatureUrl && signatureUrl.startsWith('data:image')) {
        try {
          const signatureFile = dataURLtoFile(signatureUrl, `signature_${Date.now()}.png`);
          signatureUrl = await uploadImageFile(signatureFile, "booking_signature");
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
              const url = await uploadImageFile(imgFile, "booking_concern");
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
      await createBooking(bookingData);
      toast.success("Booking and payment submitted successfully!");
      sessionStorage.removeItem("paymentDetails");
      sessionStorage.removeItem("pendingHomeBooking");
      // Redirect based on the booking type
      navigate("/dashboard/services"); 
    } catch (error) {
      console.error("Submission error:", error);
      toast.error(error.message || "An error occurred during submission");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReceiptChange = (files) => {
    setFormData({ ...formData, receiptFile: Array.from(files || [])[0] || null });
  };

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
              <Select
                value={formData.paymentMethod}
                onValueChange={(value) => setFormData({ ...formData, paymentMethod: value })}
                disabled={isSubmitting || isLoadingPaymentMethods}
                searchPlaceholder="Search payment method"
              >
                <SelectTrigger id="paymentMethod">
                  <SelectValue placeholder={isLoadingPaymentMethods ? "Loading payment methods..." : "Select payment method"} displayValue={selectedMethod?.label} />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((method) => (
                    <SelectItem key={method.value} value={method.value} searchText={method.label}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Payment Method Instructions */}
            {selectedMethod && (
              <Card className="bg-green-50 border-green-200">
                <CardContent className="pt-6">
                  <div className="flex gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-gray-900 mb-1">{selectedMethod.label} Instructions:</p>
                      <p className="whitespace-pre-wrap text-sm text-gray-700">{paymentMethodInstruction(selectedMethod)}</p>
                      {selectedQrUrl && (
                        <button
                          type="button"
                          onClick={() => setViewer({ src: selectedQrUrl, alt: `${selectedMethod.label} QR` })}
                          className="mt-3 group block rounded-lg border border-green-100 bg-white p-2 text-left transition hover:border-green-300 focus:outline-none focus:ring-2 focus:ring-green-200"
                          aria-label={`Open larger ${selectedMethod.label} QR image`}
                        >
                          <img src={selectedQrUrl} alt={`${selectedMethod.label} QR`} className="max-h-48 rounded-md object-contain" />
                        </button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">Amount to Pay *</Label>
              <Input
                id="amount"
                type="number"
                required
                readOnly={!!paymentData?.amount}
                restriction="decimal"
                className="pl-14 bg-gray-50 font-bold text-lg text-blue-600"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                disabled={isSubmitting}
                leftIcon={<span className="text-xs font-semibold">PHP</span>}
              />
              {paymentData?.amount && (
                  <p className="text-[10px] text-amber-600 font-medium italic">* This is the projected home-service amount for display and review.</p>
              )}
            </div>

            {/* Reference Number */}
            <div className="space-y-2">
              <Label htmlFor="referenceNumber">Reference/Transaction Number</Label>
              <Input
                id="referenceNumber"
                placeholder="Enter reference number (if applicable)"
                restriction="alphanumeric"
                value={formData.referenceNumber}
                onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
                disabled={isSubmitting}
              />
              <p className="text-xs text-gray-500">
                For QRPH, Maya, GCash, and Bank Transfer, please include the transaction reference number
              </p>
            </div>

            {/* Receipt Upload */}
            <div className="space-y-2">
              <Label htmlFor="receipt">Upload Payment Proof/Receipt {selectedMethodRequiresProof && "*"}</Label>
              <FileUploadDropzone
                id="receipt"
                accept="image/*,.pdf"
                files={formData.receiptFile ? [formData.receiptFile] : []}
                onFilesSelected={handleReceiptChange}
                onRemove={() => setFormData({ ...formData, receiptFile: null })}
                disabled={isSubmitting}
                label="Click to upload receipt"
                helper="PNG, JPG, WEBP, GIF, or PDF up to 8 MB"
              />
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
            <SubmissionStatus
              active={isSubmitting}
              label="Finalizing booking..."
              slowLabel="Still finalizing booking..."
            />

            <Button type="submit" className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700" disabled={isSubmitting || isLoadingPaymentMethods}>
              {isSubmitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Finalizing Booking...</>
              ) : (
                  "Confirm and Submit Booking"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
      <PhotoViewer
        open={Boolean(viewer)}
        src={viewer?.src || ""}
        alt={viewer?.alt || "Payment QR"}
        onOpenChange={(open) => !open && setViewer(null)}
      />
    </div>
  );
}


