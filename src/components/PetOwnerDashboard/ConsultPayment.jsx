import { useState, useEffect } from "react";
import { useNavigate } from "./dashboardRouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { Input } from "../../ui/input";
import { Textarea } from "../../ui/textarea";
import { toast } from "../../reusecomponent/toast.jsx";
import { ArrowLeft, Upload, CheckCircle, AlertCircle } from "lucide-react";

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

  const handleSubmit = (e) => {
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

    // Simulate payment processing
    setTimeout(() => {
      // Create consultation booking
      const consultationId = Date.now().toString();
      const consultation = {
        id: consultationId,
        ...bookingData,
        status: "pending_verification",
        paymentStatus: "pending_verification",
        paymentMethod: formData.paymentMethod,
        referenceNumber: formData.referenceNumber,
        amount: formData.amount,
        bookedAt: new Date().toISOString(),
        consultationLink: `https://meet.vetfocuscare.com/${consultationId}`,
      };

      // Save to user's consultations
      const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
      const users = JSON.parse(localStorage.getItem("users") || "[]");
      const userIndex = users.findIndex((u) => u.id === currentUser.id);

      if (userIndex !== -1) {
        if (!users[userIndex].consultations) {
          users[userIndex].consultations = [];
        }
        users[userIndex].consultations.push(consultation);
        localStorage.setItem("users", JSON.stringify(users));
        localStorage.setItem("currentUser", JSON.stringify(users[userIndex]));
      }

      // Clear pending booking
      sessionStorage.removeItem("pendingBooking");

      setIsProcessing(false);
      toast.success("Payment submitted successfully! Awaiting verification from our team.");
      navigate(`/dashboard/consult/confirmation/${consultationId}`);
    }, 2000);
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
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <Input
                  id="receipt"
                  type="file"
                  required={formData.paymentMethod !== "cash"}
                  accept="image/*,.pdf"
                  onChange={handleReceiptChange}
                  className="max-w-xs mx-auto"
                />
                <p className="text-sm text-gray-500 mt-2">
                  Upload screenshot or photo of your receipt/transaction
                </p>
                {formData.receiptFile && (
                  <p className="text-sm text-green-600 mt-2">
                    ✓ File selected: {formData.receiptFile.name}
                  </p>
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

