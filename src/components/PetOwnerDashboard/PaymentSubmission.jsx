import { useNavigate } from "./dashboardRouter";
import { toast } from "../../reusecomponent/toast.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { Input } from "../../ui/input";
import { Textarea } from "../../ui/textarea";
import { ArrowLeft, Upload, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";
import { useState } from "react";

export default function PaymentSubmission() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    paymentMethod: "",
    referenceNumber: "",
    amount: "",
    notes: "",
    receiptFile: null,
    additionalImages: [],
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.paymentMethod) {
      toast.error("Please select a payment method");
      return;
    }
    if (!formData.receiptFile) {
      toast.error("Please upload proof of payment");
      return;
    }
    toast.success("Payment submitted successfully! Awaiting verification from our team.");
    navigate("/dashboard/services");
  };

  const handleReceiptChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFormData({ ...formData, receiptFile: e.target.files[0] });
    }
  };

  const handleImagesChange = (e) => {
    if (e.target.files) {
      setFormData({ ...formData, additionalImages: Array.from(e.target.files) });
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

  return (
    <div className="space-y-6 lg:space-y-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Complete Payment</h1>
          <p className="text-gray-600 mt-1">Submit your payment details for verification</p>
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
                  required
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

            {/* Additional Images */}
            <div className="space-y-2">
              <Label htmlFor="images">Additional Images (Optional)</Label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <Input
                  id="images"
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImagesChange}
                  className="max-w-xs mx-auto"
                />
                <p className="text-sm text-gray-500 mt-2">
                  Upload any additional supporting images
                </p>
                {formData.additionalImages.length > 0 && (
                  <p className="text-sm text-green-600 mt-2">
                    ✓ {formData.additionalImages.length} file(s) selected
                  </p>
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
              />
            </div>

            {/* Submit Button */}
            <Button type="submit" className="w-full h-12 text-base">
              Submit Payment for Verification
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Maya Payment Integration Info (for reference) */}
      {formData.paymentMethod === "maya" && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <ExternalLink className="h-5 w-5 text-blue-600 shrink-0" />
              <div className="text-sm text-gray-700">
                <p className="font-semibold mb-1">Maya Payment Integration</p>
                <p>
                  In a live environment, you would be redirected to Maya's secure checkout page to complete your
                  payment.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

