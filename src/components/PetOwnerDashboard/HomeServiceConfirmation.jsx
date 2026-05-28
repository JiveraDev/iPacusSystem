import { useEffect, useState } from "react";
import { useNavigate } from "../dashboardRouter.jsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../ui/card";
import { Button } from "../../ui/button";
import { Checkbox } from "../../ui/checkbox";
import { Label } from "../../ui/label";
import { Input } from "../../ui/input";
import { Textarea } from "../../ui/textarea";
import { toast } from "../../reusecomponent/toast.jsx";
import { 
  Calendar, Clock, MapPin, AlertCircle, FileText, 
  ShieldCheck, Upload, CheckCircle, Loader2, ArrowLeft, X 
} from "lucide-react";
import SignatureCapture from "../SignatureCapture";
import { formatDisplayDate, formatDisplayTime } from "../../lib/date";
import { DECEASED_PET_BOOKING_MESSAGE, isDeceasedPetStatus } from "../../lib/petStatus";

export default function HomeServiceConfirmation() {
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [signature, setSignature] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [consents, setConsents] = useState({
    terms: false,
    privacy: false,
    visit: false
  });

  // Payment Form State
  const [paymentFormData, setPaymentFormData] = useState({
    paymentMethod: "",
    referenceNumber: "",
    amount: "50", // Fixed transport fee for home service
    notes: "",
    receiptFile: null
  });

  useEffect(() => {
    const pendingBooking = sessionStorage.getItem("pendingHomeBooking");
    if (pendingBooking) {
      setBooking(JSON.parse(pendingBooking));
    }
  }, []);

  const dataURLtoFile = (dataurl, filename) => {
    if (!dataurl) return null;
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

  const handleFinalSubmit = async (e) => {
    e.preventDefault();

    if (isDeceasedPetStatus(booking?.petStatus)) {
      toast.error(DECEASED_PET_BOOKING_MESSAGE);
      navigate("/dashboard/services/home-services");
      return;
    }
    
    if (!consents.terms || !consents.privacy || !consents.visit) {
      toast.error("Please agree to all terms and conditions.");
      return;
    }
    if (!signature) {
      toast.error("Please provide your signature.");
      return;
    }
    if (!paymentFormData.paymentMethod) {
      toast.error("Please select a payment method.");
      return;
    }
    if (!paymentFormData.receiptFile && paymentFormData.paymentMethod !== "cash") {
      toast.error("Please upload proof of payment.");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Upload Receipt
      const receiptUrl = paymentFormData.receiptFile
        ? await uploadFile(paymentFormData.receiptFile, "booking_payment")
        : null;

      // 2. Upload Signature
      let finalSignatureUrl = signature;
      if (signature.startsWith('data:image')) {
        const signatureFile = dataURLtoFile(signature, `signature_${Date.now()}.png`);
        finalSignatureUrl = await uploadFile(signatureFile, "booking_signature");
      }

      // 3. Upload Additional Images (Concerns)
      let uploadedConcernUrls = [];
      if (booking.images && Array.isArray(booking.images)) {
        for (let i = 0; i < booking.images.length; i++) {
          const img = booking.images[i];
          if (img.startsWith('data:image')) {
            const imgFile = dataURLtoFile(img, `concern_${Date.now()}_${i}.png`);
            const url = await uploadFile(imgFile, "booking_concern");
            uploadedConcernUrls.push(url);
          } else {
            uploadedConcernUrls.push(img);
          }
        }
      }

      // 4. Prepare Final Booking Data
      const finalBookingData = {
        ...booking,
        signature: finalSignatureUrl,
        payment_proof_url: receiptUrl,
        payment_method: paymentFormData.paymentMethod,
        payment_reference: paymentFormData.referenceNumber,
        price: paymentFormData.amount,
        specific_location: booking.specific_location,
        Image_Booking_Concern_Path: uploadedConcernUrls.length > 0 ? uploadedConcernUrls[0] : null
      };

      // 5. Submit to DB
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalBookingData),
      });

      if (response.ok) {
        toast.success("Home Service Booking submitted successfully!");
        sessionStorage.removeItem("pendingHomeBooking");
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

  const paymentMethods = [
    {
      value: "maya",
      label: "Maya",
      instructions: "Send to Maya: 0917-XXX-XXXX (iPawcus). Upload screenshot.",
    },
    {
      value: "gcash",
      label: "GCash",
      instructions: "Send to GCash: 0917-XXX-XXXX (iPawcus). Upload screenshot.",
    },
    {
      value: "cash",
      label: "Cash Payment",
      instructions: "Our personnel will verify your booking and call you for identification before the admin confirms it.",
    },
  ];

  const selectedMethod = paymentMethods.find((m) => m.value === paymentFormData.paymentMethod);

  if (!booking) {
    return (
      <div className="mx-auto max-w-4xl space-y-8 p-4 sm:p-8">
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">Booking Data Not Found</h3>
            <p className="text-gray-600 mb-4">We couldn't find your booking details.</p>
            <Button onClick={() => navigate("/dashboard/services/home-services")}>Back to Home Services</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-10">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
          <FileText className="h-10 w-10 text-blue-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Review Your Request</h1>
        <p className="text-gray-500">Please verify details, sign, and complete the transport fee payment</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-lg">Service & Pet</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold">Pet Name</p>
              <p className="font-semibold text-lg">{booking.new_pet_name || booking.petName || "Selected Pet"}</p>
              <p className="text-sm text-gray-600">{booking.petType} - {booking.new_pet_breed || booking.petBreed || "Registered Breed"}</p>
            </div>
            <div className="pt-4 border-t">
              <p className="text-xs text-gray-500 uppercase font-bold">Requested Services</p>
              <p className="text-sm font-medium mt-1">{booking.notes.match(/\[Services: (.*?)\]/)?.[1] || "Home Service"}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Schedule & Location</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold">Preferred Date</p>
                <p className="font-semibold">{formatDisplayDate(booking.booking_date)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                    <p className="text-xs text-gray-500 uppercase font-bold">Preferred Time</p>
                    <p className="font-semibold">{formatDisplayTime(booking.booking_time)}</p>
                </div>
            </div>
            <div className="flex items-start gap-3 pt-2 border-t">
              <MapPin className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold">Service Address</p>
                <p className="text-sm font-medium">{booking.address}</p>
                {booking.specific_location && (
                  <p className="text-xs text-gray-600 mt-1 italic">
                    <span className="font-semibold text-gray-700">Specific Location:</span> {booking.specific_location}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-green-600" />
                    Consent & Digital Signature
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="bg-gray-50 p-4 rounded-lg border space-y-4">
                    <div className="flex items-start space-x-3">
                        <Checkbox id="terms" checked={consents.terms} onCheckedChange={(v) => setConsents({...consents, terms: v})} />
                        <div className="grid gap-1.5 leading-none">
                            <Label htmlFor="terms" className="text-sm font-medium">I agree to the service fees and terms</Label>
                            <p className="text-xs text-gray-500">I understand the ₱50 transport fee is non-refundable.</p>
                        </div>
                    </div>
                    <div className="flex items-start space-x-3">
                        <Checkbox id="visit" checked={consents.visit} onCheckedChange={(v) => setConsents({...consents, visit: v})} />
                        <div className="grid gap-1.5 leading-none">
                            <Label htmlFor="visit" className="text-sm font-medium">I authorize the veterinary visit</Label>
                        </div>
                    </div>
                    <div className="flex items-start space-x-3">
                        <Checkbox id="privacy" checked={consents.privacy} onCheckedChange={(v) => setConsents({...consents, privacy: v})} />
                        <div className="grid gap-1.5 leading-none">
                            <Label htmlFor="privacy" className="text-sm font-medium">Data Privacy Consent</Label>
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    <Label className="font-semibold text-gray-900">Digital Signature *</Label>
                    <SignatureCapture 
                        signature={signature} 
                        onSignatureChange={setSignature} 
                        disabled={!consents.terms || !consents.privacy || !consents.visit}
                    />
                </div>
            </CardContent>
        </Card>

        {/* Payment Section - Hidden until signature is provided */}
        {signature && (
          <Card className="md:col-span-2 border-blue-200 bg-blue-50/30 animate-in fade-in slide-in-from-top-4 duration-500">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-blue-800">
                <CheckCircle className="h-5 w-5 text-blue-600" />
                Transport Fee Payment (₱50)
              </CardTitle>
              <CardDescription>Finalize your booking by submitting the transport fee</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleFinalSubmit} className="space-y-6">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Payment Method *</Label>
                      <select
                        required
                        className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white"
                        value={paymentFormData.paymentMethod}
                        onChange={(e) => setPaymentFormData({ ...paymentFormData, paymentMethod: e.target.value })}
                        disabled={isSubmitting}
                      >
                        <option value="">Select method</option>
                        {paymentMethods.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    </div>

                    {selectedMethod && (
                      <div className="bg-green-50 border border-green-200 p-3 rounded-lg text-xs text-green-800">
                        <p className="font-bold mb-1">{selectedMethod.label} Instructions:</p>
                        <p>{selectedMethod.instructions}</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Reference Number</Label>
                      <Input
                        placeholder="Transaction ID"
                        value={paymentFormData.referenceNumber}
                        onChange={(e) => setPaymentFormData({ ...paymentFormData, referenceNumber: e.target.value })}
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Upload Receipt *</Label>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center bg-white hover:border-blue-400 transition-colors min-h-[200px] flex flex-col items-center justify-center relative overflow-hidden">
                        {paymentFormData.receiptFile ? (
                          <div className="relative w-full flex flex-col items-center animate-in zoom-in duration-300">
                            <div className="relative group">
                              <img 
                                src={URL.createObjectURL(paymentFormData.receiptFile)} 
                                alt="Receipt Preview" 
                                className="max-h-[250px] w-auto max-w-full object-contain rounded-lg shadow-md border border-gray-100"
                              />
                              <button
                                type="button"
                                onClick={() => setPaymentFormData({...paymentFormData, receiptFile: null})}
                                className="absolute -top-3 -right-3 bg-red-500 text-white p-2 rounded-full shadow-xl hover:bg-red-600 transition-all transform hover:scale-110 z-10"
                                title="Remove receipt"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                            <div className="mt-3 flex items-center gap-2 px-3 py-1 bg-gray-50 rounded-full border border-gray-200">
                              <CheckCircle className="h-3 w-3 text-green-500" />
                              <span className="max-w-[min(200px,calc(100vw-7rem))] truncate text-xs font-medium text-gray-600">
                                {paymentFormData.receiptFile.name}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <label className="cursor-pointer w-full h-full py-8 flex flex-col items-center justify-center">
                            <Upload className="h-10 w-10 text-gray-400 mb-3" />
                            <span className="text-sm font-semibold text-blue-600">Click to upload receipt</span>
                            <span className="text-xs text-gray-400 mt-1">PNG, JPG or PDF up to 10MB</span>
                            <Input
                              type="file"
                              required={paymentFormData.paymentMethod !== "cash"}
                              accept="image/*"
                              onChange={(e) => setPaymentFormData({...paymentFormData, receiptFile: e.target.files[0]})}
                              disabled={isSubmitting}
                              className="hidden"
                            />
                          </label>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Amount</Label>
                      <Input value="₱50.00" readOnly className="bg-gray-100 font-bold text-blue-600" />
                    </div>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg" 
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Finalizing Booking...</>
                  ) : (
                    "Confirm and Submit Booking"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>

      {!signature && (
        <div className="flex flex-col sm:flex-row gap-4">
          <Button variant="outline" onClick={() => navigate("/dashboard/services/home-services")} className="flex-1 h-12">
            Edit Details
          </Button>
          <Button disabled className="flex-1 h-12">
            Please Sign to Continue
          </Button>
        </div>
      )}
    </div>
  );
}
