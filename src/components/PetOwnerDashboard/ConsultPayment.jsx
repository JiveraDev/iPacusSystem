import { useState, useEffect } from "react";
import { useNavigate } from "../dashboardRouter.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { Input } from "../../ui/input";
import { Textarea } from "../../ui/textarea";
import { Checkbox } from "../../ui/checkbox";
import { toast } from "../../reusecomponent/toast.jsx";
import { ArrowLeft, Upload, CheckCircle, AlertCircle, X, ShieldCheck } from "lucide-react";
import SignatureCapture from "../SignatureCapture";
import { DECEASED_PET_BOOKING_MESSAGE, isDeceasedPetStatus } from "../../lib/petStatus";

export default function ConsultPayment() {
  const navigate = useNavigate();
  const [bookingData, setBookingData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [signature, setSignature] = useState(null);
  const [consents, setConsents] = useState({
    terms: false,
    privacy: false,
    teleconsult: false,
  });
  const [formData, setFormData] = useState({
    paymentMethod: "",
    referenceNumber: "",
    senderNumber: "",
    amount: "",
    receiptFile: null,
  });

  useEffect(() => {
    const pending = sessionStorage.getItem("pendingBooking");
    if (!pending) {
      navigate("/dashboard/consult/booking");
      return;
    }
    setBookingData(JSON.parse(pending));
  }, [navigate]);

  const dataURLtoFile = (dataurl, filename) => {
    if (!dataurl) return null;

    const [header, base64Value] = dataurl.split(",");
    const mime = header.match(/:(.*?);/)?.[1] || "image/png";
    const binary = atob(base64Value);
    const array = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      array[index] = binary.charCodeAt(index);
    }

    return new File([array], filename, { type: mime });
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

    if (isDeceasedPetStatus(bookingData?.petStatus)) {
      toast.error(DECEASED_PET_BOOKING_MESSAGE);
      navigate("/dashboard/consult/booking");
      return;
    }
    
    if (!consents.terms || !consents.privacy || !consents.teleconsult) {
      toast.error("Please agree to all consultation consent items");
      return;
    }
    if (!signature) {
      toast.error("Please provide your digital signature");
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
    
    setIsProcessing(true);

    try {
      const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
      
      // 1. Upload Receipt if available
      let receiptUrl = null;
      if (formData.receiptFile) {
        receiptUrl = await uploadFile(formData.receiptFile, "booking_payment");
      }

      let finalSignatureUrl = signature;
      if (signature.startsWith("data:image")) {
        const signatureFile = dataURLtoFile(signature, `signature_${Date.now()}.png`);
        finalSignatureUrl = await uploadFile(signatureFile, "booking_signature");
      }

      const uploadedConcernUrls = [];
      if (Array.isArray(bookingData.concernImages)) {
        for (let index = 0; index < bookingData.concernImages.length; index += 1) {
          const image = bookingData.concernImages[index];
          if (typeof image === "string" && image.startsWith("data:image")) {
            const imageFile = dataURLtoFile(image, `consult_concern_${Date.now()}_${index}.png`);
            const url = await uploadFile(imageFile, "booking_concern");
            uploadedConcernUrls.push(url);
          } else if (image) {
            uploadedConcernUrls.push(image);
          }
        }
      }

      // 2. Prepare Final Booking Data
      const finalBookingData = {
        user_id: currentUser.id || currentUser.user_id,
        pet_id: bookingData.petId === "new-pet" ? null : bookingData.petDbId || bookingData.petId,
        service_type: "consultation",
        booking_date: bookingData.date,
        booking_time: bookingData.time,
        notes: [
          `[Topic: ${bookingData.discussionTopic}]`,
          bookingData.notes ? bookingData.notes : "",
          formData.senderNumber ? `[Sender Number: ${formData.senderNumber}]` : "",
          formData.referenceNumber ? `[Transaction Reference: ${formData.referenceNumber}]` : ""
        ].filter(Boolean).join("\n"),
        petType: bookingData.petSpecies,
        registered_status: bookingData.petId === "new-pet" ? "Not Registered" : "Registered",
        new_pet_name: bookingData.petId === "new-pet" ? bookingData.petName : null,
        new_pet_breed: bookingData.petId === "new-pet" ? bookingData.petBreed : null,
        new_pet_age: bookingData.petId === "new-pet" ? bookingData.petAge : null,
        new_pet_weight: bookingData.petId === "new-pet" ? bookingData.petWeight : null,
        is_online_consultation: 1,
        veterinarian_id: bookingData.veterinarianId,
        signature: finalSignatureUrl,
        Image_Booking_Concern_Path: uploadedConcernUrls.length > 0 ? uploadedConcernUrls.join(",") : null,
        payment_proof_url: receiptUrl,
        payment_method: formData.paymentMethod,
        payment_reference: formData.referenceNumber,
        price: formData.amount || "500"
      };

      // 3. Submit to DB
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalBookingData),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success("Consultation booking submitted successfully!");
        sessionStorage.removeItem("pendingBooking");
        navigate(`/dashboard/consult/confirmation/${result.booking_id || "success"}`);
      } else {
        const error = await response.json();
        throw new Error(error.message || "Failed to create consultation booking");
      }
    } catch (error) {
      console.error("Submission error:", error);
      toast.error(error.message || "An error occurred during submission");
    } finally {
      setIsProcessing(false);
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

  if (!bookingData) {
    return null;
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <Button variant="ghost" onClick={() => navigate("/dashboard/consult/booking")} className="self-start">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Complete Payment</h1>
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
                <li>• You will receive a confirmation email once verified</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-green-600" />
            Consent & Digital Signature
          </CardTitle>
          <CardDescription>Confirm the online consultation consent before submitting payment</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4 rounded-lg border bg-gray-50 p-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id="consultTerms"
                checked={consents.terms}
                onCheckedChange={(checked) => setConsents({ ...consents, terms: checked })}
              />
              <div className="space-y-1">
                <Label htmlFor="consultTerms" className="text-sm font-medium">
                  I agree to the online consultation fee and terms
                </Label>
                <p className="text-xs text-gray-500">
                  I understand the consultation will be reviewed after payment verification.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox
                id="consultTelehealth"
                checked={consents.teleconsult}
                onCheckedChange={(checked) => setConsents({ ...consents, teleconsult: checked })}
              />
              <div className="space-y-1">
                <Label htmlFor="consultTelehealth" className="text-sm font-medium">
                  I authorize online veterinary consultation
                </Label>
                <p className="text-xs text-gray-500">
                  I understand that an online consultation may require an in-clinic follow-up when needed.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox
                id="consultPrivacy"
                checked={consents.privacy}
                onCheckedChange={(checked) => setConsents({ ...consents, privacy: checked })}
              />
              <div className="space-y-1">
                <Label htmlFor="consultPrivacy" className="text-sm font-medium">
                  Data Privacy Consent
                </Label>
                <p className="text-xs text-gray-500">
                  I allow the clinic to use the submitted pet details, photos, and signature for this booking.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="font-semibold text-gray-900">Digital Signature *</Label>
            <SignatureCapture
              signature={signature}
              onSignatureChange={setSignature}
              disabled={!consents.terms || !consents.privacy || !consents.teleconsult}
            />
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
              <Label htmlFor="amount">Amount Paid *</Label>
              <Input
                id="amount"
                type="number"
                required
                placeholder="Enter amount (e.g., 500.00)"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              />
            </div>

            {/* Reference Number */}
            <div className="space-y-2">
              <Label htmlFor="referenceNumber">Reference/Transaction Number</Label>
              <Input
                id="referenceNumber"
                placeholder="Enter reference number (if applicable)"
                value={formData.referenceNumber}
                onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
              />
              <p className="text-xs text-gray-500">
                For digital payments (Maya, GCash), please include the transaction reference number
              </p>
            </div>

            {/* Sender Number */}
            <div className="space-y-2">
              <Label htmlFor="senderNumber">Sender Number / Account Details</Label>
              <Textarea
                id="senderNumber"
                placeholder="Enter the sender's number or account name used for payment"
                value={formData.senderNumber}
                onChange={(e) => setFormData({ ...formData, senderNumber: e.target.value })}
                rows={3}
              />
              <p className="text-xs text-gray-500">
                Required for online payments so the admin can match the payment to the correct sender.
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
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <Button type="submit" className="w-full h-12 text-base" disabled={isProcessing}>
              {isProcessing ? "Submitting Payment..." : "Submit Payment"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

