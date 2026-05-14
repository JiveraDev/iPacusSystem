import { useState, useEffect } from "react";
import { useNavigate } from "./dashboardRouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { Input } from "../../ui/input";
import { Textarea } from "../../ui/textarea";
import { toast } from "../../reusecomponent/toast.jsx";
import { ArrowLeft, Upload, CheckCircle, AlertCircle, X } from "lucide-react";

export default function ConsultPayment() {
  const navigate = useNavigate();
  const [bookingData, setBookingData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [formData, setFormData] = useState({
    paymentMethod: "",
    referenceNumber: "",
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

      // 2. Prepare Final Booking Data
      const finalBookingData = {
        user_id: currentUser.id,
        pet_id: bookingData.petId === "new-pet" ? null : bookingData.petId,
        service_type: "consultation",
        booking_date: bookingData.date,
        booking_time: bookingData.time,
        notes: `[Topic: ${bookingData.discussionTopic}] ${bookingData.notes}`,
        petType: bookingData.petSpecies,
        registered_status: bookingData.petId === "new-pet" ? "Not Registered" : "Registered",
        new_pet_name: bookingData.petId === "new-pet" ? bookingData.petName : null,
        new_pet_breed: bookingData.petId === "new-pet" ? bookingData.petBreed : null,
        new_pet_age: bookingData.petId === "new-pet" ? bookingData.petAge : null,
        new_pet_weight: bookingData.petId === "new-pet" ? bookingData.petWeight : null,
        is_online_consultation: 1,
        veterinarian_id: bookingData.veterinarianId,
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
      value: "bank",
      label: "Bank Transfer",
      instructions: "Transfer to: BDO Account #XXXX-XXXX-XXXX, Account Name: iPawcus Veterinary Clinic. Upload bank receipt or screenshot.",
    },
    {
      value: "cash",
      label: "Cash Payment",
      instructions: "Pay at our clinic counter. Please bring this booking reference and obtain an official receipt.",
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
      <div className="flex items-center gap-4">
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
                For digital payments (Maya, GCash, Bank Transfer), please include the transaction reference number
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
                      <span className="text-xs font-medium text-gray-600 truncate max-w-[200px]">
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

